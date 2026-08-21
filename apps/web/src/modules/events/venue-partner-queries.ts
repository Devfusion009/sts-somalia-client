import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Venue Portal data layer — the events-side mirror of
 * src/modules/hotels/partner-queries.ts. Everything is RLS-scoped: venue
 * partners only ever see their own venue_partners row, their own venues
 * (event_venues.partner_id), and the hall bookings on those venues.
 */

export async function getMyVenuePartnerId(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_partner_members")
    .select("partner_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data?.partner_id ?? null;
}

export async function getMyVenuePartner(partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_partners")
    .select("id, name, contact_email, status, commission_rate")
    .eq("id", partnerId)
    .maybeSingle();
  return data;
}

export async function getMyVenues(partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select("id, name, slug, city, address, tagline, description, capacity_seated, capacity_standing, size_sqm, event_types, base_price, currency, price_unit, status, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getVenueForEdit(partnerId: string, venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select("id, name, city, address, tagline, description, capacity_seated, capacity_standing, size_sqm, event_types, base_price, currency, price_unit, status")
    .eq("partner_id", partnerId)
    .eq("id", venueId)
    .maybeSingle();
  return data;
}

/** Booking requests across all of this partner's venues, oldest-first (the queue promise). */
export async function getVenueBookings(partnerId: string) {
  const supabase = await createClient();
  const { data: venues } = await supabase.from("event_venues").select("id").eq("partner_id", partnerId);
  const venueIds = (venues ?? []).map((v) => v.id);
  if (venueIds.length === 0) return [];

  const { data } = await supabase
    .from("hall_bookings")
    .select(
      "id, booking_ref, event_type, event_name, start_date, end_date, start_time, end_time, expected_guests, setup_requirements, price, currency, status, created_at, venue:event_venues(name), customer:profiles!hall_bookings_customer_id_fkey(full_name, email, phone)"
    )
    .in("venue_id", venueIds)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getVenuePartnerStats(partnerId: string) {
  const bookings = await getVenueBookings(partnerId);
  return {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    revenue: bookings
      .filter((b) => ["confirmed", "completed"].includes(b.status))
      .reduce((sum, b) => sum + Number(b.price), 0),
  };
}
