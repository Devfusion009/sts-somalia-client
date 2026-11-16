import { Injectable } from "@nestjs/common";
import { addCalendarDays, buildDatedItinerary } from "@sts/shared-types";
import type { PackageCard, PackageDetail, SharingPriceMap, UmrahOperations, UmrahService } from "@sts/shared-types";
import { PackageRepository } from "../repositories/package.repository";
import { ServiceCatalogRepository } from "../repositories/service-catalog.repository";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";
import { CustomRequestRepository } from "../repositories/custom-request.repository";
import { UmrahSettingsRepository } from "../repositories/umrah-settings.repository";
import { toPackageCard, toPackageDetail } from "../mappers/package.mapper";
import { RedisService } from "../../../infra/redis/redis.service";

const CATALOG_TTL_SECONDS = 300;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * What a visitor can browse (published packages, the private-trip service
 * catalog, operating settings) and the dated travel plan of one booking.
 */
@Injectable()
export class UmrahCatalogService {
  constructor(
    private readonly packages: PackageRepository,
    private readonly services: ServiceCatalogRepository,
    private readonly bookings: UmrahBookingRepository,
    private readonly requests: CustomRequestRepository,
    private readonly settings: UmrahSettingsRepository,
    private readonly cache: RedisService
  ) {}

  /** Featured first, then cheapest — the landing band reads as a ladder from the entry package. */
  async featuredPackages(limit: number): Promise<PackageCard[]> {
    const rows = await this.packages.findPublishedCards({ featuredFirst: true });
    return rows.map((r) => toPackageCard(r, today()))
      .filter((card) => card.package_type === "private" || card.nextDeparture !== null).slice(0, limit);
  }

  async assignedPackages(): Promise<PackageCard[]> {
    return (await this.packages.findAssignedCards()).map(row => toPackageCard(row, today()));
  }

  async allPackages(): Promise<PackageCard[]> {
    const rows = await this.packages.findPublishedCards({ featuredFirst: false });
    return rows.map((r) => toPackageCard(r, today()))
      .filter((card) => card.package_type === "private" || card.nextDeparture !== null);
  }

  async packageBySlug(slug: string): Promise<PackageDetail | null> {
    const id = await this.packages.findIdBySlug(slug);
    if (id) await this.packages.releaseStaleSeats(id);
    const row = await this.packages.findPublishedDetail(slug);
    return row ? toPackageDetail(row) : null;
  }

  /** Published add-on services are the same for every visitor: cached, tag "umrah-services". */
  publishedServices(): Promise<UmrahService[]> {
    return this.cache.cachedRead("umrah:services:published", CATALOG_TTL_SECONDS, () => this.services.findPublished(), {
      tags: ["umrah-services"],
    });
  }

  sharingPrices(): Promise<SharingPriceMap> {
    return this.cache.cachedRead(
      "umrah:services:sharing-prices",
      CATALOG_TTL_SECONDS,
      () => this.services.findPublishedSharingPrices(),
      { tags: ["umrah-services"] }
    );
  }

  operations(): Promise<UmrahOperations> {
    return this.settings.getOperations();
  }

  /**
   * What a booking's own page shows the traveller or their agent: pilgrims,
   * stage history, documents (signed links), readiness and travel — all read
   * under the caller's RLS.
   */
  async bookingFile(bookingId: string) {
    const [pilgrims, history, documents, readinessRows, travel] = await Promise.all([
      this.bookings.pilgrims(bookingId),
      this.bookings.history(bookingId),
      this.bookings.documents(bookingId),
      this.bookings.readiness(bookingId),
      this.bookingTravel(bookingId),
    ]);
    const urls = await this.bookings.signDocuments(documents.map((d) => d.storage_path));
    return {
      pilgrims,
      history,
      documents: documents.map((d) => ({ ...d, url: urls.get(d.storage_path) ?? null })),
      readiness: Object.fromEntries(readinessRows.map((r) => [r.pilgrim_id, { missing: r.missing, warnings: r.warnings }])) as Record<
        string,
        { missing: string[]; warnings: string[] }
      >,
      travel,
    };
  }

  /**
   * A booking's travel cards and itinerary, read under the caller's RLS
   * (customer, agency member or admin). Private trips use the hotels chosen in
   * the builder, Makkah first, for the nights set on the request.
   */
  async bookingTravel(bookingId: string) {
    const booking = await this.bookings.travelBase(bookingId);
    if (!booking) return null;
    const pkg = one(booking.package as Row | null);
    const departure = one(booking.departure as Row | null);
    const request = one(booking.custom_request as Row | null);

    const [hotelRows, dayRows, segmentRows, requestHotelRows] = await Promise.all([
      booking.package_id ? this.bookings.packageHotels(booking.package_id) : Promise.resolve([] as Row[]),
      booking.package_id ? this.bookings.packageDays(booking.package_id) : Promise.resolve([] as Row[]),
      this.bookings.segments(bookingId),
      booking.custom_request_id ? this.requests.findHotelLines(booking.custom_request_id) : Promise.resolve([]),
    ]);

    const snapshot = request?.package_snapshot as Row | null;
    const departureDate: string | null = snapshot?.departureDate ?? departure?.departure_date ?? request?.departure_date ?? null;
    const hotels: Row[] =
      snapshot && Array.isArray(snapshot.hotels) ? snapshot.hotels : booking.booking_kind === "private" && request
        ? [
            ...requestHotelRows
              .filter((h) => h.category === "hotel_makkah" && request.nights_makkah > 0)
              .map((h) => ({ city: "makkah", name: h.name, nights: request.nights_makkah, sort_order: 0 })),
            ...requestHotelRows
              .filter((h) => h.category === "hotel_madinah" && request.nights_madinah > 0)
              .map((h) => ({ city: "madinah", name: h.name, nights: request.nights_madinah, sort_order: 1 })),
          ]
        : hotelRows;

    const flight = (prefix: "outbound" | "return") =>
      departure
        ? {
            airline: departure[`${prefix}_airline`],
            flightNumber: departure[`${prefix}_flight_number`],
            departsAt: departure[`${prefix}_departs_at`],
            arrivesAt: departure[`${prefix}_arrives_at`],
          }
        : null;

    const itinerary = departureDate
      ? buildDatedItinerary({
          departureDate,
          returnDate:
            snapshot?.returnDate ?? departure?.return_date ??
            (request ? addCalendarDays(request.departure_date, request.nights_makkah + request.nights_madinah) : null),
          durationDays: pkg?.duration_days ?? null,
          outbound: flight("outbound"),
          inbound: flight("return"),
          hotels: hotels as never,
          days: dayRows as never,
          segments: segmentRows as never,
        })
      : null;

    return {
      itinerary,
      hotels: hotels.map((h) => {
        const stay = itinerary?.stays.find((s) => s.name === h.name && s.city === h.city) ?? null;
        return {
          city: h.city as string,
          name: h.name as string,
          star_rating: (h.star_rating as number | null) ?? null,
          distance_to_haram_m: (h.distance_to_haram_m as number | null) ?? null,
          room_type: (h.room_type as string | null) ?? null,
          checkIn: stay?.checkIn ?? null,
          checkOut: stay?.checkOut ?? null,
        };
      }),
      segments: segmentRows as {
        id: string;
        kind: string;
        title: string;
        provider: string | null;
        reference: string | null;
        starts_at: string | null;
        ends_at: string | null;
        city: string | null;
        notes: string | null;
      }[],
      contact: pkg
        ? {
            name: pkg.contact_person_name as string | null,
            phone: pkg.contact_person_phone as string | null,
            email: pkg.contact_person_email as string | null,
            whatsapp: pkg.contact_whatsapp as string | null,
          }
        : null,
    };
  }
}
