import { Injectable, BadRequestException } from "@nestjs/common";
import { computeHallPrice, venueCapacity } from "@sts/shared-types";
import type {
  CreateHallBookingInput,
  CreateHallBookingResult,
  PublicVenue,
  PublicVenueDetail,
  VenueFilters,
  VenueOccupiedRangesInput,
} from "@sts/shared-types";
import { OrdersService } from "../orders/orders.service";
import { notifyPartnerOfBooking } from "../../infra/notify/partner-booking-notify";
import { VenueRepository } from "./repositories/venue.repository";
import { HallBookingRepository } from "./repositories/hall-booking.repository";
import { VenuePartnerRepository } from "./repositories/venue-partner.repository";
import { toPublicVenue, toPublicVenueDetail } from "./mappers/venue.mapper";

/**
 * Customer-facing events rules: browsing published venues and placing a hall
 * booking. Data access lives in the repositories; this file holds the
 * decisions (dates, capacity, availability, price, who the booking is for).
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly venues: VenueRepository,
    private readonly bookings: HallBookingRepository,
    private readonly partners: VenuePartnerRepository,
    private readonly orders: OrdersService
  ) {}

  async getVenues(filters: VenueFilters = {}): Promise<PublicVenue[]> {
    let venues = (await this.venues.findPublished()).map(toPublicVenue);
    if (filters.city) {
      const needle = filters.city.trim().toLowerCase();
      venues = venues.filter((v) => v.city.toLowerCase().includes(needle));
    }
    if (filters.eventType) {
      const type = filters.eventType;
      venues = venues.filter((v) => v.event_types.includes(type));
    }
    return venues;
  }

  async getVenueBySlug(slug: string): Promise<PublicVenueDetail | null> {
    const row = await this.venues.findPublishedBySlug(slug);
    return row ? toPublicVenueDetail(row as Record<string, unknown>) : null;
  }

  async getVenueEventTypes(): Promise<string[]> {
    const set = new Set<string>();
    for (const venue of await this.getVenues()) for (const t of venue.event_types) set.add(t);
    return [...set].sort();
  }

  /** Requires login — agents checking availability, not public browsing. */
  async getVenueOccupiedRanges(input: VenueOccupiedRangesInput) {
    return this.venues.findOccupiedRanges(input.venueId, input.from, input.to);
  }

  async createHallBooking(userId: string, input: CreateHallBookingInput): Promise<CreateHallBookingResult> {
    const startDate = new Date(`${input.startDate}T00:00:00`);
    const endDate = new Date(`${input.endDate}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || startDate < new Date(new Date().toDateString())) {
      throw new BadRequestException("The start date must be in the future.");
    }
    if (Number.isNaN(endDate.getTime()) || endDate < startDate) {
      throw new BadRequestException("The end date can't be before the start date.");
    }

    const venue = await this.venues.findPublishedForBooking(input.venueId);
    if (!venue) throw new BadRequestException("This venue is no longer available.");

    if (Number(venue.base_price) <= 0) {
      throw new BadRequestException("This venue has no price yet. Contact us to book it.");
    }

    const capacity = venueCapacity(venue);
    if (capacity && input.expectedGuests > capacity) {
      throw new BadRequestException(`This venue holds up to ${capacity} guests.`);
    }

    const agencyId = await this.orders.getActiveAgencyId(userId);

    // The insert trigger is the authority under concurrency; this early
    // check only gives a customer a clean message. Agency bookings skip it:
    // the allocator may seat them by displacing unpaid online requests,
    // which a plain overlap check can't see.
    if (!agencyId) {
      const free = await this.venues.isSlotAvailable(venue.id, input.startDate, input.endDate, input.startTime, input.endTime);
      if (!free) throw new BadRequestException("This venue is already booked for that slot.");
    }

    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "hall");
    if (!access.ok) throw new BadRequestException(access.message);
    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, {
      agencyCustomerId: input.agencyCustomerId,
      newCustomerName: input.newCustomerName,
      newCustomerPhone: input.newCustomerPhone,
    });
    // An agency books for its own customer: the venue sees that person as
    // the client, not the agent who typed the booking in.
    const bookedFor = agencyCustomerId ? await this.orders.getAgencyCustomerContact(agencyCustomerId) : null;

    const price = computeHallPrice({
      basePrice: Number(venue.base_price),
      priceUnit: venue.price_unit,
      expectedGuests: input.expectedGuests,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    if (price.needsTimes) throw new BadRequestException("Choose a start and end time.");

    const booking = await this.bookings.insert({
      venue_id: venue.id,
      customer_id: userId,
      booked_by: userId,
      agency_id: agencyId,
      event_type: input.eventType,
      event_name: input.eventName ?? null,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      expected_guests: input.expectedGuests,
      setup_requirements: input.setupRequirements ?? null,
      ...(bookedFor
        ? {
            contact_name: bookedFor.full_name,
            contact_phone: bookedFor.phone ? bookedFor.phone.slice(0, 30) : null,
            contact_email: bookedFor.email ? bookedFor.email.slice(0, 160) : null,
          }
        : {}),
      price: price.total,
      currency: venue.currency,
    });

    if (venue.partner_id) {
      const partner = await this.partners.findPartner(venue.partner_id).catch(() => null);
      if (partner) {
        void notifyPartnerOfBooking({
          partnerEmail: partner.contact_email,
          partnerPhone: partner.contact_phone,
          propertyName: venue.name,
          summary: `${input.eventType}, ${input.expectedGuests} guests, ${input.startDate}${input.endDate !== input.startDate ? ` → ${input.endDate}` : ""}`,
        }).catch(() => {});
      }
    }

    const order = await this.orders.createForBooking({
      customerId: userId,
      bookedBy: userId,
      agencyId,
      agencyCustomerId,
      currency: venue.currency,
      itemType: "hall",
      price: price.total,
      hallBookingId: booking.id,
    });

    // Every venue here has a price, so the booking is paid at checkout.
    return { orderId: order.id, requiresPriceConfirmation: false };
  }
}
