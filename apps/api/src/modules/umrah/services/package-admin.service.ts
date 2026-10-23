import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  UMRAH_INCLUDE_KEYS,
  departureErrorMessage,
  type DepartureUpsertInput,
  type ItineraryDayInput,
  type PackageDetailsInput,
  type PackageHotelInput,
  type PackagePricingInput,
  type PackageUpsertInput,
} from "@sts/shared-types";
import { PackageRepository } from "../repositories/package.repository";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";
import { UmrahNotifyService } from "./umrah-notify.service";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function imagePaths(images: unknown): string[] {
  return Array.isArray(images) ? images.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
}

const FLIGHT_FIELDS = [
  "departure_date",
  "return_date",
  "outbound_airline",
  "outbound_flight_number",
  "outbound_departs_at",
  "outbound_arrives_at",
  "return_airline",
  "return_flight_number",
  "return_departs_at",
  "return_arrives_at",
] as const;

/** Wall-clock flight time as entered, stored UTC-tagged and always read back in UTC. */
function flightTime(value: string | null) {
  return value ? `${value}:00Z` : null;
}

/** Admin: packages, their gallery, hotels, day plan, rate card, agencies and departures. */
@Injectable()
export class PackageAdminService {
  constructor(
    private readonly packages: PackageRepository,
    private readonly bookings: UmrahBookingRepository,
    private readonly notify: UmrahNotifyService
  ) {}

  list() {
    return this.packages.findAllAdmin();
  }

  async get(id: string) {
    const pkg = await this.packages.findByIdAdmin(id);
    if (!pkg) throw new NotFoundException("Package not found.");
    return pkg;
  }

  async upsert(input: PackageUpsertInput) {
    const row = {
      name: input.name,
      description: input.description || null,
      duration_days: input.durationDays,
      // A stale form may post an include the app no longer renders; it is dropped.
      includes: input.includes.filter((v) => (UMRAH_INCLUDE_KEYS as readonly string[]).includes(v)),
      base_price: input.basePrice,
      currency: input.currency.toUpperCase(),
      status: input.status,
    };
    if (input.id) await this.packages.updatePackage(input.id, row);
    else await this.packages.insertPackage({ ...row, slug: slugify(input.name) });
  }

  async updateDetails(d: PackageDetailsInput) {
    await this.packages.updatePackage(d.packageId, {
      tagline: d.tagline || null,
      tier: d.tier || null,
      is_featured: d.isFeatured,
      origin_iata: d.originIata || null,
      destination_iata: d.destinationIata || null,
      original_price: d.originalPrice,
      meal_plan: d.mealPlan,
      meals_note: d.mealsNote || null,
      contact_person_name: d.contactPersonName || null,
      contact_person_phone: d.contactPersonPhone || null,
      contact_person_email: d.contactPersonEmail || null,
      contact_whatsapp: d.contactWhatsapp || null,
      deposit_percent: d.depositPercent,
      balance_due_days: d.balanceDueDays,
      full_payment_before_documents: d.fullPaymentBeforeDocuments,
    });
  }

  // ---- gallery: sign, browser PUT, commit ----

  async signImage(packageId: string, name: string) {
    const path = `${packageId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    return this.packages.signImageUpload(path);
  }

  async commitImage(packageId: string, path: string) {
    const prefix = `${packageId}/`;
    if (!path.startsWith(prefix) || path.includes("..") || path.slice(prefix.length).includes("/")) {
      throw new BadRequestException("Unknown file.");
    }
    if (!(await this.packages.imageExists(path))) throw new BadRequestException("The file didn't finish uploading.");
    const images = await this.packages.findImages(packageId);
    if (images === undefined) throw new NotFoundException("Unknown package.");
    const current = imagePaths(images);
    if (current.includes(path)) return;
    try {
      await this.packages.setImages(packageId, [...current, path]);
    } catch (e) {
      await this.packages.removeImages([path]);
      throw e;
    }
  }

  async removeImage(packageId: string, path: string) {
    const images = await this.packages.findImages(packageId);
    if (images === undefined) return;
    await this.packages.setImages(packageId, imagePaths(images).filter((p) => p !== path));
    await this.packages.removeImages([path]);
  }

  /** Index 0 is the cover shot used on cards and the detail hero. */
  async setCover(packageId: string, path: string) {
    const paths = imagePaths(await this.packages.findImages(packageId));
    if (!paths.includes(path)) return;
    await this.packages.setImages(packageId, [path, ...paths.filter((p) => p !== path)]);
  }

  // ---- hotels, days, rate card, agencies ----

  saveHotel(d: PackageHotelInput) {
    return this.packages.upsertHotel(d.hotelRowId, {
      package_id: d.packageId,
      city: d.city,
      name: d.name,
      star_rating: d.starRating,
      distance_to_haram_m: d.distanceToHaramM,
      nights: d.nights,
      room_type: d.roomType || null,
      sort_order: d.sortOrder,
    });
  }

  deleteHotel(packageId: string, rowId: string) {
    return this.packages.deleteHotel(packageId, rowId);
  }

  async saveItineraryDay(d: ItineraryDayInput) {
    const saved = await this.packages.upsertItineraryDay(d.dayId, {
      package_id: d.packageId,
      day_number: d.dayNumber,
      title: d.title,
      description: d.description || null,
    });
    if (!saved) throw new BadRequestException(`Day ${d.dayNumber} already exists — edit it instead.`);
  }

  deleteItineraryDay(packageId: string, rowId: string) {
    return this.packages.deleteItineraryDay(packageId, rowId);
  }

  async savePricing(d: PackagePricingInput) {
    await this.packages.upsertPricing(d.packageId, d.sharing, d.price);
    await this.syncBasePrice(d.packageId);
  }

  async deletePricing(packageId: string, rowId: string) {
    await this.packages.deletePricing(packageId, rowId);
    await this.syncBasePrice(packageId);
  }

  /** With a rate card, base_price (charged and advertised) is the cheapest sharing rate. */
  private async syncBasePrice(packageId: string) {
    const prices = await this.packages.findPricingPrices(packageId);
    if (prices.length) await this.packages.updatePackage(packageId, { base_price: Math.min(...prices) });
  }

  setAgencies(packageId: string, agencyIds: string[]) {
    return this.packages.replaceAgencies(packageId, agencyIds);
  }

  // ---- departures ----

  private departureRow(d: DepartureUpsertInput) {
    if (d.returnDate <= d.departureDate) throw new BadRequestException("Return date must be after the departure date.");
    if (d.offlineSeats > d.totalSeats) throw new BadRequestException("Seats sold exceed total seats.");
    if (d.outboundDepartsAt && d.outboundArrivesAt && d.outboundArrivesAt <= d.outboundDepartsAt) {
      throw new BadRequestException("Outbound arrival must be after departure.");
    }
    if (d.returnDepartsAt && d.returnArrivesAt && d.returnArrivesAt <= d.returnDepartsAt) {
      throw new BadRequestException("Return arrival must be after departure.");
    }
    return {
      departure_date: d.departureDate,
      return_date: d.returnDate,
      total_seats: d.totalSeats,
      offline_seats: d.offlineSeats,
      price_override: d.priceOverride,
      outbound_airline: d.outboundAirline || null,
      outbound_flight_number: d.outboundFlightNumber || null,
      outbound_departs_at: flightTime(d.outboundDepartsAt),
      outbound_arrives_at: flightTime(d.outboundArrivesAt),
      return_airline: d.returnAirline || null,
      return_flight_number: d.returnFlightNumber || null,
      return_departs_at: flightTime(d.returnDepartsAt),
      return_arrives_at: flightTime(d.returnArrivesAt),
      baggage_note: d.baggageNote || null,
      sales_close_days: d.salesCloseDays,
      // A cancelled departure posts no status and stays cancelled.
      ...(d.status ? { status: d.status } : {}),
    };
  }

  /** A rate-card package is charged from the rate card, so an override would never be charged. */
  private async assertNoOverrideOnRateCard(packageId: string, priceOverride: number | null) {
    if (priceOverride === null) return;
    if ((await this.packages.findPricingPrices(packageId)).length > 0) {
      throw new BadRequestException("This package is priced by room sharing.");
    }
  }

  async saveDeparture(d: DepartureUpsertInput) {
    const row = this.departureRow(d);
    if (!d.departureId) {
      await this.assertNoOverrideOnRateCard(d.packageId, row.price_override);
      const error = await this.packages.insertDeparture({ package_id: d.packageId, ...row });
      if (error) throw new BadRequestException(departureErrorMessage(error));
      return;
    }

    const before = await this.packages.findDepartureFlights(d.departureId);
    if (row.price_override !== (before?.price_override ?? null)) {
      await this.assertNoOverrideOnRateCard(d.packageId, row.price_override);
    }
    const { updated, error } = await this.packages.updateDeparture(d.departureId, d.packageId, row);
    if (error) throw new BadRequestException(departureErrorMessage(error));
    if (!updated) throw new NotFoundException("Departure not found.");

    // In-app alerts come from a trigger; this adds email / WhatsApp for every live booking.
    const changed =
      before &&
      FLIGHT_FIELDS.some((field) => {
        const next = (row as Record<string, unknown>)[field] ?? null;
        const prev = before[field] ?? null;
        return field.endsWith("_at") && next && prev
          ? new Date(String(next)).getTime() !== new Date(String(prev)).getTime()
          : next !== prev;
      });
    if (changed) {
      for (const id of await this.bookings.findLiveBookingIds(d.departureId)) this.notify.send(id, "flight_changed");
    }
  }

  async deleteDeparture(departureId: string) {
    const departure = await this.packages.findDepartureForDelete(departureId);
    if (!departure) throw new NotFoundException("Departure not found.");
    if (departure.booked_seats > 0) throw new BadRequestException("This departure has bookings and cannot be deleted.");
    const error = await this.packages.deleteDeparture(departureId);
    if (error) throw new BadRequestException(departureErrorMessage(error));
    return { packageId: departure.package_id };
  }
}

/** The admin package page's row, exported for apps/web: tRPC's client inference is too deep for it (TS2589). */
export type UmrahPackageAdmin = Awaited<ReturnType<PackageAdminService["get"]>>;
/** One row of the admin package list, exported for the same reason. */
export type UmrahPackageAdminListItem = Awaited<ReturnType<PackageAdminService["list"]>>[number];
