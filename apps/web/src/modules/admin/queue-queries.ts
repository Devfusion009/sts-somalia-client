import { createClient } from "@/lib/supabase/server";

/**
 * The manual-booking work queue: every hotel, hall and private-Umrah request
 * that still needs a human decision, in strict order-placed sequence
 * (created_at ASC — first come, first served). Somali hotels and event halls
 * have no APIs, and a private Umrah is priced against dates STS has not yet
 * held, so nothing here confirms itself: staff work this list top-down.
 */
export type QueueEntry = {
  kind: "hotel" | "hall" | "umrah";
  id: string;
  title: string;
  subtitle: string;
  customerName: string | null;
  customerEmail: string | null;
  price: number;
  currency: string;
  status: string;
  createdAt: string;
};

export async function getBookingQueue(): Promise<QueueEntry[]> {
  const supabase = await createClient();

  const [{ data: hotelRows }, { data: hallRows }, { data: umrahRows }] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select(
        "id, check_in, check_out, num_rooms, num_adults, status, total_price, currency, created_at, hotel:hotels(name), room:hotel_rooms(name), customer:profiles!hotel_bookings_customer_id_fkey(full_name, email)"
      )
      .in("status", ["pending", "waitlisted"])
      .order("created_at", { ascending: true }),
    supabase
      .from("hall_bookings")
      .select(
        "id, event_type, event_name, start_date, end_date, expected_guests, status, price, currency, created_at, venue:event_venues(name), customer:profiles!hall_bookings_customer_id_fkey(full_name, email)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // booking_kind = 'private' only: a group booking is taken against a
    // scheduled departure with real seat inventory, so it is already
    // confirmed by construction and has nothing for staff to decide here.
    supabase
      .from("umrah_bookings")
      .select(
        "id, num_pilgrims, status, total_price, currency, created_at, request:umrah_custom_requests!umrah_bookings_custom_request_id_fkey(reference, departure_date, nights_makkah, nights_madinah, tier), customer:profiles!umrah_bookings_customer_id_fkey(full_name, email)"
      )
      .eq("booking_kind", "private")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const entries: QueueEntry[] = [
    ...(hotelRows ?? []).map((b): QueueEntry => {
      const hotel = b.hotel as unknown as { name: string } | null;
      const room = b.room as unknown as { name: string } | null;
      const customer = b.customer as unknown as { full_name: string | null; email: string } | null;
      return {
        kind: "hotel",
        id: b.id,
        title: hotel?.name ?? "Hotel booking",
        subtitle: `${room?.name ?? "Room"} · ${b.check_in} → ${b.check_out} · ${b.num_rooms} room${b.num_rooms > 1 ? "s" : ""}, ${b.num_adults} adult${b.num_adults > 1 ? "s" : ""}`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
        price: Number(b.total_price),
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at,
      };
    }),
    ...(hallRows ?? []).map((b): QueueEntry => {
      const venue = b.venue as unknown as { name: string } | null;
      const customer = b.customer as unknown as { full_name: string | null; email: string } | null;
      return {
        kind: "hall",
        id: b.id,
        title: venue?.name ?? "Hall booking",
        subtitle: `${b.event_name ?? b.event_type} · ${b.start_date}${b.end_date && b.end_date !== b.start_date ? ` → ${b.end_date}` : ""}${b.expected_guests ? ` · ${b.expected_guests} guests` : ""}`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
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
      return {
        kind: "umrah",
        id: b.id,
        title: `Private Umrah · ${request?.reference ?? "request"}`,
        subtitle: `${request?.tier ?? "custom"} · ${
          request?.departure_date ?? "dates to confirm"
        } · ${b.num_pilgrims} traveller${b.num_pilgrims > 1 ? "s" : ""} · ${
          request ? `${request.nights_makkah}N Makkah / ${request.nights_madinah}N Madinah` : ""
        }`,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
        price: Number(b.total_price),
        currency: b.currency,
        status: b.status,
        createdAt: b.created_at,
      };
    }),
  ];

  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
