import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { Database, VenueUpsertInput, UpdateMyVenueInput, UpdateVenueBookingStatusInput } from "@sts/shared-types";

type BookingStatus = UpdateVenueBookingStatusInput["status"];

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

function venueRow(d: VenueUpsertInput) {
  return {
    name: d.name,
    city: d.city,
    tagline: d.tagline || null,
    description: d.description || null,
    address: d.address || null,
    capacity_seated: d.capacitySeated ?? null,
    capacity_standing: d.capacityStanding ?? null,
    size_sqm: d.sizeSqm ?? null,
    event_types: d.eventTypes ? d.eventTypes.split(",").map((t) => t.trim()).filter(Boolean) : [],
    base_price: d.basePrice,
    currency: d.currency.toUpperCase(),
    price_unit: d.priceUnit,
    status: d.status,
  };
}

/**
 * Direct port of apps/web's modules/events/venue-partner-{queries,actions}.ts
 * — the Venue Portal data layer (events-side mirror of hotels/partner-queries.ts).
 * Everything RLS-scoped: venue partners only see their own venue_partners
 * row, their own venues, and bookings on those venues.
 */
@Injectable()
export class VenuePartnerService {
  constructor(private readonly rls: RlsSupabaseService) {}

  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  async getMyVenuePartnerId(profileId: string) {
    const { data } = await this.rls
      .get()
      .from("venue_partner_members")
      .select("partner_id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return data?.partner_id ?? null;
  }

  async getMyVenuePartner(partnerId: string) {
    const { data } = await this.rls
      .get()
      .from("venue_partners")
      .select("id, name, contact_email, status, commission_rate")
      .eq("id", partnerId)
      .maybeSingle();
    return data;
  }

  async getMyVenues(partnerId: string) {
    const { data } = await this.rls
      .get()
      .from("event_venues")
      .select(
        "id, name, slug, city, address, tagline, description, capacity_seated, capacity_standing, size_sqm, event_types, base_price, currency, price_unit, status, created_at"
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async getVenueForEdit(partnerId: string, venueId: string) {
    const { data } = await this.rls
      .get()
      .from("event_venues")
      .select(
        "id, name, city, address, tagline, description, capacity_seated, capacity_standing, size_sqm, event_types, base_price, currency, price_unit, status"
      )
      .eq("partner_id", partnerId)
      .eq("id", venueId)
      .maybeSingle();
    return data;
  }

  /** Booking requests across all of this partner's venues, newest first — needs join typing, uses db(). */
  async getVenueBookings(partnerId: string) {
    const { data: venues } = await this.rls.get().from("event_venues").select("id").eq("partner_id", partnerId);
    const venueIds = (venues ?? []).map((v) => v.id);
    if (venueIds.length === 0) return [];

    const { data } = await this.db()
      .from("hall_bookings")
      .select(
        "id, booking_ref, event_type, event_name, start_date, end_date, start_time, end_time, expected_guests, setup_requirements, price, currency, status, created_at, contact_name, contact_phone, contact_email, venue:event_venues(name), customer:profiles!hall_bookings_customer_id_fkey(full_name, email, phone)"
      )
      .in("venue_id", venueIds)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async getVenuePartnerStats(partnerId: string) {
    const bookings = await this.getVenueBookings(partnerId);
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      revenue: bookings
        .filter((b) => ["confirmed", "completed"].includes(b.status))
        .reduce((sum, b) => sum + Number(b.price), 0),
    };
  }

  async createMyVenue(profileId: string, input: VenueUpsertInput) {
    const partnerId = await this.getMyVenuePartnerId(profileId);
    if (!partnerId) throw new BadRequestException("No active venue partner membership found.");

    const { error } = await this.rls
      .get()
      .from("event_venues")
      .insert({ ...venueRow(input), slug: slugify(input.name), partner_id: partnerId });
    if (error) throw new BadRequestException(error.message);
  }

  async updateMyVenue(profileId: string, input: UpdateMyVenueInput) {
    const partnerId = await this.getMyVenuePartnerId(profileId);
    if (!partnerId) throw new BadRequestException("No active venue partner membership found.");

    const supabase = this.rls.get();

    // Once admin publishes, a partner edit must not silently un-publish —
    // only touch status while the venue is still in the partner's hands.
    const { data: current } = await supabase
      .from("event_venues")
      .select("status")
      .eq("id", input.venueId)
      .eq("partner_id", partnerId)
      .maybeSingle();
    if (!current) throw new NotFoundException("Venue not found.");

    const row = venueRow(input);
    const update = ["draft", "pending_review"].includes(current.status) ? row : { ...row, status: undefined };
    const { error } = await supabase.from("event_venues").update(update).eq("id", input.venueId).eq("partner_id", partnerId);
    if (error) throw new BadRequestException(error.message);
  }

  async updateVenueBookingStatus(profileId: string, bookingId: string, status: BookingStatus) {
    const partnerId = await this.getMyVenuePartnerId(profileId);
    if (!partnerId) throw new BadRequestException("No active venue partner membership found.");

    // RLS restricts the update to bookings on this partner's own venues; the
    // explicit null-check just turns a silent no-op into a real error.
    const { data: updated, error } = await this.rls
      .get()
      .from("hall_bookings")
      .update({ status })
      .eq("id", bookingId)
      .select("id")
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!updated) throw new NotFoundException("Booking not found.");
  }
}
