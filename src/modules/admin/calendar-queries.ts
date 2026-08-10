import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CalendarBookingKind = "hotel" | "flight" | "umrah" | "hall";

export type CalendarBookingEvent = {
  id: string;
  kind: CalendarBookingKind;
  title: string;
  location: string | null;
  startDate: string; // yyyy-mm-dd, for grid positioning
  endDate: string;
  status: string;
  price: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Ordered, type-specific fields shown in the detail dialog — "Rooms", "Cabin class", "Pilgrims", etc. */
  detail: { label: string; value: string }[];
};

type AgencyCustomerContact = { full_name: string; email: string | null; phone: string | null };

/**
 * When an agent books for one of their own "client book" contacts
 * (agency_customers — a lightweight record, NOT a profiles/auth row; see
 * modules/agencies/booked-for.ts), the booking row's own customer_id FK is
 * NOT NULL and MUST reference profiles(id) — so it's set to the AGENT's own
 * profile, same as booked_by. The actual traveler's name/phone only exists
 * one hop further out, on orders.agency_customer_id (mirrors the same join
 * getAgencyOrders already does in modules/agencies/queries.ts). Without
 * this lookup, every agent-booked-for-a-client trip would show the agent as
 * "the customer" and hide the real traveler's contact info entirely.
 */
async function getAgencyCustomerContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingIds: { hotel: string[]; flight: string[]; umrah: string[]; hall: string[] }
) {
  const result = {
    hotel: new Map<string, AgencyCustomerContact>(),
    flight: new Map<string, AgencyCustomerContact>(),
    umrah: new Map<string, AgencyCustomerContact>(),
    hall: new Map<string, AgencyCustomerContact>(),
  };

  const orFilters: string[] = [];
  if (bookingIds.hotel.length) orFilters.push(`hotel_booking_id.in.(${bookingIds.hotel.join(",")})`);
  if (bookingIds.flight.length) orFilters.push(`flight_booking_id.in.(${bookingIds.flight.join(",")})`);
  if (bookingIds.umrah.length) orFilters.push(`umrah_booking_id.in.(${bookingIds.umrah.join(",")})`);
  if (bookingIds.hall.length) orFilters.push(`hall_booking_id.in.(${bookingIds.hall.join(",")})`);
  if (orFilters.length === 0) return result;

  const { data } = await supabase
    .from("order_items")
    .select(
      "hotel_booking_id, flight_booking_id, umrah_booking_id, hall_booking_id, order:order_id (agency_customer:agency_customer_id (full_name, email, phone))"
    )
    .or(orFilters.join(","));

  for (const row of data ?? []) {
    const contact = row.order?.agency_customer;
    if (!contact) continue;
    if (row.hotel_booking_id) result.hotel.set(row.hotel_booking_id, contact);
    if (row.flight_booking_id) result.flight.set(row.flight_booking_id, contact);
    if (row.umrah_booking_id) result.umrah.set(row.umrah_booking_id, contact);
    if (row.hall_booking_id) result.hall.set(row.hall_booking_id, contact);
  }
  return result;
}

/**
 * Every booking type across the platform whose customer actually shows up
 * somewhere on a calendar (visa applications have no trip date to anchor
 * on, so they're intentionally excluded — they already have their own
 * pipeline view at /admin/visa). Admin sees full customer contact info
 * directly; no RLS workaround needed here since is_admin() already grants
 * full read on every one of these tables.
 */
export async function getCalendarBookings(from: string, to: string): Promise<CalendarBookingEvent[]> {
  const supabase = await createClient();

  const [hotelRes, flightRes, umrahRes, hallRes] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select(
        `id, check_in, check_out, num_rooms, num_adults, num_children, special_requests, status, total_price, currency,
         hotel:hotel_id (name, city, address_line),
         customer:customer_id (full_name, email, phone)`
      )
      .lte("check_in", to)
      .gte("check_out", from),
    supabase
      .from("flight_bookings")
      .select(
        `id, origin_iata, destination_iata, depart_at, return_at, trip_type, cabin_class, status, total_price, currency,
         customer:customer_id (full_name, email, phone)`
      )
      .gte("depart_at", `${from}T00:00:00Z`)
      .lte("depart_at", `${to}T23:59:59Z`),
    supabase
      .from("umrah_bookings")
      .select(
        `id, num_pilgrims, special_requests, status, total_price, currency,
         package:package_id (name),
         departure:departure_id!inner (departure_date, return_date),
         customer:customer_id (full_name, email, phone)`
      )
      .lte("departure.departure_date", to)
      .gte("departure.return_date", from),
    supabase
      .from("hall_bookings")
      .select(
        `id, event_type, event_name, start_date, end_date, expected_guests, setup_requirements, status, price, currency,
         venue:venue_id (name, city, address),
         customer:customer_id (full_name, email, phone)`
      )
      .lte("start_date", to)
      .gte("end_date", from),
  ]);

  const contacts = await getAgencyCustomerContacts(supabase, {
    hotel: (hotelRes.data ?? []).map((b) => b.id),
    flight: (flightRes.data ?? []).map((b) => b.id),
    umrah: (umrahRes.data ?? []).map((b) => b.id),
    hall: (hallRes.data ?? []).map((b) => b.id),
  });

  const events: CalendarBookingEvent[] = [];

  for (const b of hotelRes.data ?? []) {
    const contact = contacts.hotel.get(b.id);
    events.push({
      id: b.id,
      kind: "hotel",
      title: b.hotel?.name ?? "Hotel booking",
      location: b.hotel ? [b.hotel.city, b.hotel.address_line].filter(Boolean).join(", ") : null,
      startDate: b.check_in,
      endDate: b.check_out,
      status: b.status,
      price: Number(b.total_price),
      currency: b.currency,
      customerName: contact?.full_name ?? b.customer?.full_name ?? null,
      customerEmail: contact?.email ?? b.customer?.email ?? null,
      customerPhone: contact?.phone ?? b.customer?.phone ?? null,
      detail: [
        { label: "Rooms", value: String(b.num_rooms) },
        { label: "Guests", value: `${b.num_adults} adult${b.num_adults === 1 ? "" : "s"}${b.num_children ? `, ${b.num_children} child${b.num_children === 1 ? "" : "ren"}` : ""}` },
        { label: "Special requests", value: b.special_requests ?? "—" },
      ],
    });
  }

  for (const b of flightRes.data ?? []) {
    const contact = contacts.flight.get(b.id);
    const departDate = b.depart_at.slice(0, 10);
    events.push({
      id: b.id,
      kind: "flight",
      title: `${b.origin_iata} → ${b.destination_iata}`,
      location: `${b.origin_iata} → ${b.destination_iata}`,
      startDate: departDate,
      endDate: b.return_at ? b.return_at.slice(0, 10) : departDate,
      status: b.status,
      price: Number(b.total_price),
      currency: b.currency,
      customerName: contact?.full_name ?? b.customer?.full_name ?? null,
      customerEmail: contact?.email ?? b.customer?.email ?? null,
      customerPhone: contact?.phone ?? b.customer?.phone ?? null,
      detail: [
        { label: "Trip type", value: b.trip_type.replace(/_/g, " ") },
        { label: "Cabin class", value: b.cabin_class },
        { label: "Departs", value: new Date(b.depart_at).toLocaleString() },
        ...(b.return_at ? [{ label: "Returns", value: new Date(b.return_at).toLocaleString() }] : []),
      ],
    });
  }

  for (const b of umrahRes.data ?? []) {
    if (!b.departure) continue;
    const contact = contacts.umrah.get(b.id);
    events.push({
      id: b.id,
      kind: "umrah",
      title: b.package?.name ?? "Umrah package",
      location: "Makkah & Madinah, Saudi Arabia",
      startDate: b.departure.departure_date,
      endDate: b.departure.return_date,
      status: b.status,
      price: Number(b.total_price),
      currency: b.currency,
      customerName: contact?.full_name ?? b.customer?.full_name ?? null,
      customerEmail: contact?.email ?? b.customer?.email ?? null,
      customerPhone: contact?.phone ?? b.customer?.phone ?? null,
      detail: [
        { label: "Pilgrims", value: String(b.num_pilgrims) },
        { label: "Special requests", value: b.special_requests ?? "—" },
      ],
    });
  }

  for (const b of hallRes.data ?? []) {
    const contact = contacts.hall.get(b.id);
    events.push({
      id: b.id,
      kind: "hall",
      title: b.event_name || b.event_type.replace(/_/g, " "),
      location: b.venue ? [b.venue.name, b.venue.city].filter(Boolean).join(", ") : null,
      startDate: b.start_date,
      endDate: b.end_date,
      status: b.status,
      price: Number(b.price),
      currency: b.currency,
      customerName: contact?.full_name ?? b.customer?.full_name ?? null,
      customerEmail: contact?.email ?? b.customer?.email ?? null,
      customerPhone: contact?.phone ?? b.customer?.phone ?? null,
      detail: [
        { label: "Event type", value: b.event_type.replace(/_/g, " ") },
        { label: "Venue address", value: b.venue?.address ?? "—" },
        { label: "Expected guests", value: b.expected_guests ? String(b.expected_guests) : "—" },
        { label: "Setup requirements", value: b.setup_requirements ?? "—" },
      ],
    });
  }

  return events.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
