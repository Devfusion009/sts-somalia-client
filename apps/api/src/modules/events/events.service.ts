import { Injectable, BadRequestException } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { createAnonClient } from "../../infra/supabase/supabase-clients";
import { OrdersService } from "../orders/orders.service";
import { notifyPartnerOfBooking } from "../../infra/notify/partner-booking-notify";
import type { VenueFilters, VenueOccupiedRangesInput, CreateHallBookingInput } from "@sts/shared-types";

/**
 * Direct port of apps/web's modules/events/{queries,actions}.ts — the
 * customer-facing half. venue-partner-{queries,actions}.ts is the separate
 * VenuePartnerService (different audience: venue owners, not customers).
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly rls: RlsSupabaseService,
    private readonly orders: OrdersService
  ) {}

  /** Public marketing browsing — anon client, same reasoning as flights.airports. */
  async getVenues(filters: VenueFilters = {}) {
    const { data } = await createAnonClient()
      .from("event_venues")
      .select("*")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("name");

    let venues = data ?? [];
    if (filters.city) {
      const needle = filters.city.trim().toLowerCase();
      venues = venues.filter((v) => v.city.toLowerCase().includes(needle));
    }
    if (filters.eventType) {
      const type = filters.eventType;
      venues = venues.filter((v) => Array.isArray(v.event_types) && (v.event_types as string[]).includes(type));
    }
    return venues;
  }

  async getVenueBySlug(slug: string) {
    const { data } = await createAnonClient()
      .from("event_venues")
      .select("*, property_links(label, url, sort_order), property_reviews(id, author_name, rating, body, created_at)")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return data;
  }

  async getVenueEventTypes() {
    const venues = await this.getVenues();
    const set = new Set<string>();
    for (const venue of venues) {
      if (Array.isArray(venue.event_types)) {
        for (const t of venue.event_types as string[]) set.add(t);
      }
    }
    return [...set].sort();
  }

  /** Requires login — called by agents checking availability, not public browsing. */
  async getVenueOccupiedRanges(input: VenueOccupiedRangesInput) {
    const { data } = await this.rls.get().rpc("get_venue_occupied_ranges", {
      target_venue_id: input.venueId,
      from_date: input.from,
      to_date: input.to,
    });
    return data ?? [];
  }

  async createHallBooking(userId: string, input: CreateHallBookingInput) {
    const startDate = new Date(`${input.startDate}T00:00:00`);
    const endDate = new Date(`${input.endDate}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || startDate < new Date(new Date().toDateString())) {
      throw new BadRequestException("The start date must be in the future.");
    }
    if (Number.isNaN(endDate.getTime()) || endDate < startDate) {
      throw new BadRequestException("The end date can't be before the start date.");
    }

    const supabase = this.rls.get();

    const { data: venue } = await supabase
      .from("event_venues")
      .select("*")
      .eq("id", input.venueId)
      .eq("status", "published")
      .maybeSingle();
    if (!venue) throw new BadRequestException("This venue is no longer available.");

    if (venue.capacity_standing && input.expectedGuests > venue.capacity_standing) {
      throw new BadRequestException(
        `This venue hosts up to ${venue.capacity_standing} guests — please adjust the guest count or contact us for alternatives.`
      );
    }

    const { data: clash } = await supabase
      .from("hall_bookings")
      .select("id")
      .eq("venue_id", venue.id)
      .lte("start_date", input.endDate)
      .gte("end_date", input.startDate)
      .in("status", ["pending", "confirmed"])
      .limit(1)
      .maybeSingle();
    if (clash) {
      throw new BadRequestException("These dates overlap an existing booking — contact us for alternatives.");
    }

    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "hall");
    if (!access.ok) throw new BadRequestException(access.message);
    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, {
      agencyCustomerId: input.agencyCustomerId,
      newCustomerName: input.newCustomerName,
      newCustomerPhone: input.newCustomerPhone,
    });

    const estimatedPrice =
      venue.price_unit === "per_person" ? Number(venue.base_price) * input.expectedGuests : Number(venue.base_price);

    const { data: booking, error: bookingError } = await supabase
      .from("hall_bookings")
      .insert({
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
        price: estimatedPrice,
        currency: venue.currency,
      })
      .select()
      .single();
    if (bookingError || !booking) {
      throw new BadRequestException(bookingError?.message ?? "Could not create the booking. Please try again.");
    }

    if (venue.partner_id) {
      const { data: venuePartner } = await supabase
        .from("venue_partners")
        .select("contact_email, contact_phone")
        .eq("id", venue.partner_id)
        .maybeSingle();
      if (venuePartner) {
        void notifyPartnerOfBooking({
          partnerEmail: venuePartner.contact_email,
          partnerPhone: venuePartner.contact_phone,
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
      price: estimatedPrice,
      hallBookingId: booking.id,
    });

    // Per-person / price-on-request venues confirm the final price before
    // completing — matches the original's skip-checkout branch. The caller
    // (apps/web) decides where to navigate; we just report which path.
    const requiresPriceConfirmation = venue.price_unit === "per_person" || Number(venue.base_price) === 0;
    return { orderId: order.id, requiresPriceConfirmation };
  }
}
