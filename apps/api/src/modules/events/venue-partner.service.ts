import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { nextHallBookingMoves } from "@sts/shared-types";
import type { UpdateMyVenueInput, UpdateVenueBookingStatusInput, VenueUpsertInput } from "@sts/shared-types";
import { VenueRepository, type VenueWrite } from "./repositories/venue.repository";
import { HallBookingRepository } from "./repositories/hall-booking.repository";
import { VenuePartnerRepository } from "./repositories/venue-partner.repository";

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

function toVenueWrite(d: VenueUpsertInput): VenueWrite {
  return {
    name: d.name,
    city: d.city,
    tagline: d.tagline || null,
    description: d.description || null,
    address: d.address || null,
    capacity_seated: d.capacitySeated ?? null,
    capacity_standing: d.capacityStanding ?? null,
    size_sqm: d.sizeSqm ?? null,
    event_types: d.eventTypes
      ? d.eventTypes.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean)
      : [],
    base_price: d.basePrice,
    currency: d.currency.toUpperCase(),
    price_unit: d.priceUnit,
    status: d.status,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Venue Portal rules for a venue partner. The partner is always resolved
 * from the signed-in user — never taken from the request — and every read
 * and write is scoped to that partner's own venues (RLS enforces it again).
 */
@Injectable()
export class VenuePartnerService {
  constructor(
    private readonly partners: VenuePartnerRepository,
    private readonly venues: VenueRepository,
    private readonly bookings: HallBookingRepository
  ) {}

  private async requirePartnerId(profileId: string): Promise<string> {
    const partnerId = await this.partners.findActivePartnerId(profileId);
    if (!partnerId) throw new ForbiddenException("No active venue partner membership found.");
    return partnerId;
  }

  async getMyPartner(profileId: string) {
    const partnerId = await this.partners.findActivePartnerId(profileId);
    return partnerId ? this.partners.findPartner(partnerId) : null;
  }

  async getMyVenues(profileId: string) {
    return this.venues.findByPartner(await this.requirePartnerId(profileId));
  }

  async getVenueForEdit(profileId: string, venueId: string) {
    const venue = await this.venues.findOneByPartner(await this.requirePartnerId(profileId), venueId);
    if (!venue) throw new NotFoundException("Venue not found.");
    return venue;
  }

  async getVenueBookings(profileId: string) {
    const venueIds = await this.venues.findIdsByPartner(await this.requirePartnerId(profileId));
    return venueIds.length ? this.bookings.findForVenues(venueIds) : [];
  }

  async getStats(profileId: string) {
    const bookings = await this.getVenueBookings(profileId);
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending" || b.status === "waitlisted").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      revenue: bookings
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((sum, b) => sum + Number(b.price), 0),
    };
  }

  async createVenue(profileId: string, input: VenueUpsertInput) {
    const partnerId = await this.requirePartnerId(profileId);
    await this.venues.insertForPartner(partnerId, slugify(input.name), toVenueWrite(input));
  }

  async updateVenue(profileId: string, input: UpdateMyVenueInput) {
    const partnerId = await this.requirePartnerId(profileId);
    const current = await this.venues.findOneByPartner(partnerId, input.venueId);
    if (!current) throw new NotFoundException("Venue not found.");
    // Once STS publishes a venue, a partner edit must not silently
    // un-publish it: status only moves while the venue is still theirs to submit.
    const row = toVenueWrite(input);
    if (!["draft", "pending_review"].includes(current.status)) delete row.status;
    await this.venues.updateForPartner(partnerId, input.venueId, row);
  }

  async updateBookingStatus(profileId: string, input: UpdateVenueBookingStatusInput) {
    const venueIds = await this.venues.findIdsByPartner(await this.requirePartnerId(profileId));
    const booking = await this.bookings.findStatus(input.bookingId, venueIds);
    if (!booking) throw new NotFoundException("Booking not found.");
    const allowed = nextHallBookingMoves(booking, todayIso()) as string[];
    if (!allowed.includes(input.status)) {
      throw new BadRequestException(
        `A ${booking.status.replace(/_/g, " ")} booking can't be changed to ${input.status.replace(/_/g, " ")}.`
      );
    }
    if (input.status === "confirmed" && Number(booking.price) <= 0) {
      throw new BadRequestException("Set the price before confirming.");
    }
    const updated = await this.bookings.updateStatus(input.bookingId, venueIds, booking.status, input.status);
    if (!updated) throw new BadRequestException("This booking was just changed. Refresh and try again.");
  }
}
