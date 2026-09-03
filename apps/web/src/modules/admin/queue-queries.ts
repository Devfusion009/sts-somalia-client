import { createClient } from "@/lib/supabase/server";

/**
 * The manual-booking work queue: every hotel, hall and private-Umrah request
 * that still needs a human decision. Agency (B2B) requests come first, then
 * customers, oldest first within each — the same priority the database
 * allocator applies to room capacity, so what staff see matches what was
 * actually seated. Somali hotels and event halls have no APIs, and a private
 * Umrah is priced against dates STS has not yet held, so nothing here
 * confirms itself: staff work this list top-down.
 */
export type QueueEntry = {
  kind: "hotel" | "hall" | "umrah";
  id: string;
  channel: "b2b" | "b2c";
  agencyName: string | null;
  /** A customer request bumped to the waitlist by an agency booking. */
  displaced: boolean;
  title: string;
  subtitle: string;
  /**
   * On a B2B request this is the agency staffer who placed it, not the guest:
   * every vertical stamps customer_id with the booking agent's own profile.
   * The person actually travelling is travellerName below.
   */
  customerName: string | null;
  customerEmail: string | null;
  /** The agency's own client the request was placed for (B2B only). */
  travellerName: string | null;
  price: number;
  currency: string;
  status: string;
  createdAt: string;
};

/** booking id → the agency customer the order was placed for. */
async function getTravellerNames(ids: {
  hotel: string[];
  hall: string[];
  umrah: string[];
}): Promise<Map<string, string>> {
  const supabase = await createClient();
  const columns = [
    ["hotel_booking_id", ids.hotel],
    ["hall_booking_id", ids.hall],
    ["umrah_booking_id", ids.umrah],
  ] as const;

  const results = await Promise.all(
    columns.map(([column, bookingIds]) =>
      bookingIds.length === 0
        ? Promise.resolve({ data: [] })
        : supabase
            .from("order_items")
            .select(`${column}, order:order_id (agency_customer:agency_customer_id (full_name))`)
            .in(column, bookingIds)
    )
  );

  const map = new Map<string, string>();
  for (const [index, { data }] of results.entries()) {
    const [column] = columns[index];
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const bookingId = row[column];
      const order = row.order as { agency_customer: { full_name: string } | null } | null;
      if (typeof bookingId === "string" && order?.agency_customer?.full_name) {
        map.set(bookingId, order.agency_customer.full_name);
      }
    }
  }
  return map;
}

export async function getBookingQueue(): Promise<QueueEntry[]> {
  const supabase = await createClient();

  const [{ data: hotelRows }, { data: hallRows }, { data: umrahRows }] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select(
        "id, check_in, check_out, num_rooms, num_adults, status, total_price, currency, created_at, channel, displaced_by, agency:agencies(name), hotel:hotels(name), room:hotel_rooms(name), customer:profiles!hotel_bookings_customer_id_fkey(full_name, email)"
      )
      .in("status", ["pending", "waitlisted"])
      .order("created_at", { ascending: true }),
    supabase
      .from("hall_bookings")
      .select(
        "id, event_type, event_name, start_date, end_date, expected_guests, status, price, currency, created_at, agency:agencies(name), venue:event_venues(name), customer:profiles!hall_bookings_customer_id_fkey(full_name, email)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // booking_kind = 'private' only: a group booking is taken against a
    // scheduled departure with real seat inventory, so it is already
    // confirmed by construction and has nothing for staff to decide here.
    supabase
      .from("umrah_bookings")
      .select(
        "id, num_pilgrims, status, total_price, currency, created_at, agency:agencies(name), request:umrah_custom_requests!umrah_bookings_custom_request_id_fkey(reference, departure_date, nights_makkah, nights_madinah, tier), customer:profiles!umrah_bookings_customer_id_fkey(full_name, email)"
      )
      .eq("booking_kind", "private")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  // Who the agency is actually booking for. It hangs off the order rather
  // than the booking row (only visa/flight carry agency_customer_id
  // directly), so it needs this second hop through order_items.
  const travellerByBooking = await getTravellerNames({
    hotel: (hotelRows ?? []).map((b) => b.id),
    hall: (hallRows ?? []).map((b) => b.id),
    umrah: (umrahRows ?? []).map((b) => b.id),
  });

  const entries: QueueEntry[] = [
    ...(hotelRows ?? []).map((b): QueueEntry => {
      const hotel = b.hotel as unknown as { name: string } | null;
      const room = b.room as unknown as { name: string } | null;
      const customer = b.customer as unknown as { full_name: string | null; email: string } | null;
      const agency = b.agency as unknown as { name: string } | null;
      return {
        kind: "hotel",
        id: b.id,
        channel: b.channel === "b2b" ? "b2b" : "b2c",
        agencyName: agency?.name ?? null,
        displaced: b.displaced_by !== null,
        title: hotel?.name ?? "Hotel booking",
        subtitle: `${room?.name ?? "Room"} · ${b.check_in} → ${b.check_out} · ${b.num_rooms} room${b.num_rooms > 1 ? "s" : ""}, ${b.num_adults} adult${b.num_adults > 1 ? "s" : ""}`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
        travellerName: travellerByBooking.get(b.id) ?? null,
        price: Number(b.total_price),
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at,
      };
    }),
    ...(hallRows ?? []).map((b): QueueEntry => {
      const venue = b.venue as unknown as { name: string } | null;
      const customer = b.customer as unknown as { full_name: string | null; email: string } | null;
      const agency = b.agency as unknown as { name: string } | null;
      return {
        kind: "hall",
        id: b.id,
        channel: agency ? "b2b" : "b2c",
        agencyName: agency?.name ?? null,
        displaced: false,
        title: venue?.name ?? "Hall booking",
        subtitle: `${b.event_name ?? b.event_type} · ${b.start_date}${b.end_date && b.end_date !== b.start_date ? ` → ${b.end_date}` : ""}${b.expected_guests ? ` · ${b.expected_guests} guests` : ""}`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
        travellerName: travellerByBooking.get(b.id) ?? null,
        price: Number(b.price),
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at,
      };
    }),
    ...(umrahRows ?? []).map((b): QueueEntry => {
      const request = b.request as unknown as {
        reference: string;
        departure_date: string | null;
        nights_makkah: number;
        nights_madinah: number;
        tier: string;
      } | null;
      const customer = b.customer as unknown as { full_name: string | null; email: string } | null;
      const agency = b.agency as unknown as { name: string } | null;
      return {
        kind: "umrah",
        id: b.id,
        channel: agency ? "b2b" : "b2c",
        agencyName: agency?.name ?? null,
        displaced: false,
        title: `Private Umrah · ${request?.reference ?? "request"}`,
        subtitle: `${request?.tier ?? "custom"} · ${
          request?.departure_date ?? "dates to confirm"
        } · ${b.num_pilgrims} traveller${b.num_pilgrims > 1 ? "s" : ""} · ${
          request ? `${request.nights_makkah}N Makkah / ${request.nights_madinah}N Madinah` : ""
        }`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
        travellerName: travellerByBooking.get(b.id) ?? null,
        price: Number(b.total_price),
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at,
      };
    }),
  ];

  return entries.sort((a, b) => {
    if (a.channel !== b.channel) return a.channel === "b2b" ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
