import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BookingEventKind =
  | "created"
  | "status"
  | "check_in"
  | "check_out"
  | "payment"
  | "refund"
  | "rescheduled"
  | "room_assigned";

export type BookingEvent = {
  id: string;
  kind: BookingEventKind;
  fromValue: string | null;
  toValue: string | null;
  actorId: string | null;
  createdAt: string;
};

export type BookingDetail = {
  id: string;
  hotelId: string;
  hotelName: string | null;
  reference: string | null;
  orderStatus: string | null;
  status: string;
  channel: string;
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  numRooms: number;
  numAdults: number;
  numChildren: number;
  guests: Array<{ fullName: string; phone: string | null }>;
  customerEmail: string | null;
  specialRequests: string | null;
  totalPrice: number;
  currency: string;
  createdAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  onlinePayment: { methodLabel: string | null; status: string } | null;
  roomType: { id: string; name: string } | null;
  assignedUnit: { id: string; roomNumber: string; floor: string | null; locked: boolean } | null;
  units: Array<{ id: string; roomNumber: string; floor: string | null }>;
  events: BookingEvent[];
};

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(
    1,
    Math.round((new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000)
  );
}

function readGuests(raw: unknown): BookingDetail["guests"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      if (!g || typeof g !== "object") return null;
      const row = g as { full_name?: unknown; phone?: unknown };
      const fullName = typeof row.full_name === "string" ? row.full_name.trim() : "";
      if (!fullName) return null;
      return { fullName, phone: typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null };
    })
    .filter((g): g is { fullName: string; phone: string | null } => g !== null);
}

/**
 * Everything the booking detail page shows, in one place. RLS scopes every
 * read to the caller, so a booking outside the signed-in manager's hotel
 * simply comes back null. Events read as an empty list when the log is
 * unavailable: the page still renders from the booking row itself.
 */
export async function getBookingDetail(hotelId: string, bookingId: string): Promise<BookingDetail | null> {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("hotel_bookings")
    .select(
      `id, hotel_id, room_id, check_in, check_out, num_rooms, num_adults, num_children, status, channel, source,
       payment_method, payment_reference, paid_at, total_price, currency, created_at, special_requests, guest_details,
       checked_in_at, checked_out_at,
       hotel:hotels(name),
       room:hotel_rooms(id, name),
       customer:profiles!hotel_bookings_customer_id_fkey(email),
       order_items(order:orders(status, order_number, payments(method_label, status))),
       hotel_booking_room_units(locked, unit:hotel_room_units(id, room_number, floor))`
    )
    .eq("id", bookingId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (!booking) return null;

  const [{ data: events }, { data: units }] = await Promise.all([
    supabase
      .from("hotel_booking_events")
      .select("id, kind, from_value, to_value, actor_id, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    booking.room_id
      ? supabase
          .from("hotel_room_units")
          .select("id, room_number, floor")
          .eq("room_type_id", booking.room_id)
          .eq("status", "active")
          .order("floor")
          .order("room_number")
      : Promise.resolve({ data: [] as Array<{ id: string; room_number: string; floor: string | null }> }),
  ]);

  const order = booking.order_items?.[0]?.order ?? null;
  const succeeded = order?.payments?.find((p) => p.status === "succeeded") ?? null;
  const assignment = booking.hotel_booking_room_units?.[0] ?? null;

  return {
    id: booking.id,
    hotelId: booking.hotel_id,
    hotelName: booking.hotel?.name ?? null,
    reference: order?.order_number ?? null,
    orderStatus: order?.status ?? null,
    status: booking.status,
    channel: booking.channel,
    source: booking.source,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    nights: nightsBetween(booking.check_in, booking.check_out),
    numRooms: booking.num_rooms,
    numAdults: booking.num_adults,
    numChildren: booking.num_children,
    guests: readGuests(booking.guest_details),
    customerEmail: booking.customer?.email ?? null,
    specialRequests: booking.special_requests,
    totalPrice: Number(booking.total_price),
    currency: booking.currency,
    createdAt: booking.created_at,
    checkedInAt: booking.checked_in_at,
    checkedOutAt: booking.checked_out_at,
    paymentMethod: booking.payment_method,
    paymentReference: booking.payment_reference,
    paidAt: booking.paid_at,
    onlinePayment: succeeded ? { methodLabel: succeeded.method_label, status: succeeded.status } : null,
    roomType: booking.room ? { id: booking.room.id, name: booking.room.name } : null,
    assignedUnit:
      assignment && assignment.unit
        ? {
            id: assignment.unit.id,
            roomNumber: assignment.unit.room_number,
            floor: assignment.unit.floor,
            locked: assignment.locked,
          }
        : null,
    units: (units ?? []).map((u) => ({ id: u.id, roomNumber: u.room_number, floor: u.floor })),
    events: (events ?? []).map((e) => ({
      id: e.id,
      kind: e.kind as BookingEventKind,
      fromValue: e.from_value,
      toValue: e.to_value,
      actorId: e.actor_id,
      createdAt: e.created_at,
    })),
  };
}

export type TodayCounts = {
  newToday: number;
  checkedOutToday: number;
  cancelledToday: number;
  noShowToday: number;
};

/** Today's movement for the dashboard: bookings created, guests out, cancellations and no-shows. */
export async function getTodayCounts(hotelId: string, today: string): Promise<TodayCounts> {
  const supabase = await createClient();
  const since = `${today}T00:00:00Z`;
  const head = { count: "exact" as const, head: true };

  const [created, out, cancelled, noShow] = await Promise.all([
    supabase.from("hotel_bookings").select("id", head).eq("hotel_id", hotelId).gte("created_at", since),
    supabase.from("hotel_bookings").select("id", head).eq("hotel_id", hotelId).gte("checked_out_at", since),
    supabase.from("hotel_bookings").select("id", head).eq("hotel_id", hotelId).eq("status", "cancelled").gte("updated_at", since),
    supabase.from("hotel_bookings").select("id", head).eq("hotel_id", hotelId).eq("status", "no_show").gte("updated_at", since),
  ]);

  return {
    newToday: created.count ?? 0,
    checkedOutToday: out.count ?? 0,
    cancelledToday: cancelled.count ?? 0,
    noShowToday: noShow.count ?? 0,
  };
}
