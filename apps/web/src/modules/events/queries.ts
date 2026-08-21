import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getVenues(filters: { city?: string; eventType?: string } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
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
    venues = venues.filter(
      (v) => Array.isArray(v.event_types) && (v.event_types as string[]).includes(type)
    );
  }
  return venues;
}

export async function getVenueBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select("*, property_links(label, url, sort_order), property_reviews(id, author_name, rating, body, created_at)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

/** Distinct suggested event types across published venues (for filter chips). */
export async function getVenueEventTypes() {
  const venues = await getVenues();
  const set = new Set<string>();
  for (const venue of venues) {
    if (Array.isArray(venue.event_types)) {
      for (const t of venue.event_types as string[]) set.add(t);
    }
  }
  return [...set].sort();
}

export type Venue = NonNullable<Awaited<ReturnType<typeof getVenueBySlug>>>;

/**
 * Anonymized occupancy for one venue — start_date/end_date/status only, via
 * the get_venue_occupied_ranges RPC (see 20260809000003_hall_booking_date_
 * ranges.sql). Deliberately excludes customer/agency/event details: this is
 * meant for "is this date free" checks by ANY agent, including ones whose
 * own agency didn't make the booking, which normal RLS would never let them
 * read directly.
 */
export async function getVenueOccupiedRanges(venueId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_venue_occupied_ranges", {
    target_venue_id: venueId,
    from_date: from,
    to_date: to,
  });
  return data ?? [];
}
