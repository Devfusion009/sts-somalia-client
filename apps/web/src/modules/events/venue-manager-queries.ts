import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VenueManagerPermission } from "./venue-manager-permissions";

export type ManagedVenue = {
  managerId: string;
  venueId: string;
  permissions: string[];
  venue: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country_code: string;
    status: string;
    capacity_seated: number | null;
    capacity_standing: number | null;
    base_price: number;
    currency: string;
    price_unit: string;
    images: unknown;
  };
};

const VENUE_COLUMNS =
  "id, name, slug, city, country_code, status, capacity_seated, capacity_standing, base_price, currency, price_unit, images";

/**
 * Every venue the signed-in user manages, with their permission grants —
 * the venue half of the manager portal's scope (own venue_managers rows via
 * "self reads own assignment", plus the manager read policy on
 * event_venues). Pages re-check their venueId against this list so a
 * guessed URL 404s instead of leaning on RLS returning empty.
 */
export async function getMyManagedVenues(profileId: string): Promise<ManagedVenue[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_managers")
    .select(`id, venue_id, permissions, venue:event_venues(${VENUE_COLUMNS})`)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((row) => row.venue)
    .map((row) => ({
      managerId: row.id,
      venueId: row.venue_id,
      permissions: row.permissions,
      venue: row.venue as unknown as ManagedVenue["venue"],
    }));
}

/** The one assignment for this venue, or null — the per-page tenant gate. */
export async function getMyManagedVenue(profileId: string, venueId: string): Promise<ManagedVenue | null> {
  const venues = await getMyManagedVenues(profileId);
  return venues.find((v) => v.venueId === venueId) ?? null;
}

export function hasVenuePermission(managed: ManagedVenue, permission: VenueManagerPermission): boolean {
  return managed.permissions.includes(permission);
}

/** Requests still waiting on a decision — the nav badge. */
export async function getPendingHallBookingCount(venueId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("hall_bookings")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .in("status", ["pending", "waitlisted"]);
  return count ?? 0;
}

const MANAGER_SELECT = "id, created_at, permissions, profile:profiles!venue_managers_profile_id_fkey(id, full_name, email, manager_code, manager_contact_email)";

/** Active managers of one venue — admin console and the owning partner (RLS "venue_managers: authorized manage"). */
export async function getVenueManagers(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_managers")
    .select(MANAGER_SELECT)
    .eq("venue_id", venueId)
    .eq("status", "active")
    .order("created_at");
  return data ?? [];
}

/** Active managers across several venues in one round trip, grouped by venue. */
export async function getManagersForVenues(venueIds: string[]) {
  const grouped = new Map<string, Awaited<ReturnType<typeof getVenueManagers>>>();
  if (venueIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_managers")
    .select(`venue_id, ${MANAGER_SELECT}`)
    .in("venue_id", venueIds)
    .eq("status", "active")
    .order("created_at");

  for (const row of data ?? []) {
    const list = grouped.get(row.venue_id) ?? [];
    list.push(row);
    grouped.set(row.venue_id, list);
  }
  return grouped;
}

const DESK_SELECT =
  "id, booking_ref, event_type, event_name, start_date, end_date, start_time, end_time, expected_guests, setup_requirements, customer_notes, price, currency, status, source, channel, contact_name, contact_phone, contact_email, payment_method, paid_at, payment_reference, displaced_at, created_at, agency:agencies(name), order_items(order:orders(status, total))";

export type DeskBooking = Awaited<ReturnType<typeof getVenueDeskBookings>>[number];

/**
 * Closes requests whose event date has passed — one venue, or every venue for
 * admin (null). No cron runs on the deploy, so desks call this as they load.
 * A failure never blocks the page.
 */
export async function expirePastHallRequests(venueId: string | null) {
  const supabase = await createClient();
  await supabase.rpc("expire_past_hall_requests", venueId ? { p_venue_id: venueId } : {});
}

/** Every booking at one venue, newest event first. */
export async function getVenueDeskBookings(venueId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hall_bookings")
    .select(DESK_SELECT)
    .eq("venue_id", venueId)
    .order("start_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false })
    .limit(500);
  // A failed read must not render as an empty desk.
  if (error) throw error;
  return data ?? [];
}

/**
 * Bookings overlapping [from, to] that hold or held the venue, plus blocked
 * ranges — the calendar and the dashboard's agenda.
 */
export async function getVenueSchedule(venueId: string, from: string, to: string) {
  const supabase = await createClient();
  const [{ data: bookings, error: bookingsError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase
      .from("hall_bookings")
      .select(DESK_SELECT)
      .eq("venue_id", venueId)
      .in("status", ["pending", "confirmed", "completed", "waitlisted"])
      .lte("start_date", to)
      .gte("end_date", from)
      .order("start_date")
      .order("start_time", { nullsFirst: true }),
    supabase
      .from("venue_blocked_dates")
      .select("id, date_start, date_end, reason")
      .eq("venue_id", venueId)
      .lte("date_start", to)
      .gte("date_end", from)
      .order("date_start"),
  ]);
  if (bookingsError) throw bookingsError;
  if (blocksError) throw blocksError;
  return { bookings: bookings ?? [], blocks: blocks ?? [] };
}

/** Every blocked range from today on. */
export async function getUpcomingBlocks(venueId: string, today: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_blocked_dates")
    .select("id, date_start, date_end, reason")
    .eq("venue_id", venueId)
    .gte("date_end", today)
    .order("date_start");
  return data ?? [];
}

/** The venue facts every desk page shows: admin (all venues) or the venue's manager, by RLS. */
export async function getDeskVenue(venueId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_venues")
    .select(`${VENUE_COLUMNS}, event_types`)
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type DeskVenueRow = NonNullable<Awaited<ReturnType<typeof getDeskVenue>>>;

/** Payment state of a desk row: offline paid_at, else the online order's status. */
export function deskPayment(b: DeskBooking): "paid" | "part_paid" | "unpaid" | "refunded" | "none" {
  if (b.source === "offline") return b.paid_at ? "paid" : "unpaid";
  const status = b.order_items?.[0]?.order?.status;
  if (!status) return "none";
  if (status === "paid" || status === "completed" || status === "processing") return "paid";
  if (status === "partially_paid") return "part_paid";
  if (status === "refunded") return "refunded";
  return "unpaid";
}

export async function getVenueForManager(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select(
      "id, name, city, address, tagline, description, phone, contact_email, policies, images, capacity_seated, capacity_standing, event_types"
    )
    .eq("id", venueId)
    .maybeSingle();
  return data;
}

export async function getVenueReviews(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_reviews")
    .select("id, author_name, rating, body, source, status, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
