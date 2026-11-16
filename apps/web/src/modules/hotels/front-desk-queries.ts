import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hotelGuestNames } from "@/modules/orders/format";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { getStayPrices } from "@/modules/hotels/rates";

export type FrontDeskStatus =
  | "reserved"
  | "confirmed_reserved"
  | "check_in"
  | "occupied"
  | "due_out"
  | "check_out";

export type FrontDeskBar = {
  bookingId: string;
  bookingReference: string | null;
  roomUnitId: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: string;
  checkOut: string;
  status: FrontDeskStatus | null;
  isGroupBooking: boolean;
  paymentPending: boolean;
  paymentMethod: string | null;
  locked: boolean;
  totalPrice: number;
  numAdults: number;
  numChildren: number;
  notes: string | null;
};

export type FrontDeskRoomType = {
  id: string;
  name: string;
  currency: string;
  units: Array<{ id: string; roomNumber: string; floor: string | null; status: string }>;
  /** One entry per visible date: capacity + availability + price, straight
   * from the same hotel_availability RPC the booking allocator itself uses
   * — a second, ad-hoc count here would be one more place for the numbers
   * to drift from what a booking attempt actually sees. */
  dates: Array<{ date: string; available: number; total: number; price: number }>;
};

export type FrontDeskDisabledRange = {
  roomUnitId: string;
  dateStart: string;
  dateEnd: string;
  reason: string | null;
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function resolveFrontDeskStatus(
  status: "pending" | "confirmed",
  checkIn: string,
  checkOut: string,
  checkedInAt: string | null,
  checkedOutAt: string | null,
  asOf: string
): FrontDeskStatus {
  if (checkedOutAt) return "check_out";
  if (checkedInAt && asOf >= checkOut) return "due_out";
  if (checkedInAt) return "occupied";
  if (status === "pending") return "reserved";
  if (asOf >= checkIn) return "check_in";
  return "confirmed_reserved";
}

type AssignmentRow = {
  room_unit_id: string;
  locked: boolean;
  booking: {
    id: string;
    check_in: string;
    check_out: string;
    status: string;
    num_rooms: number;
    num_adults: number;
    num_children: number;
    total_price: number;
    special_requests: string | null;
    guest_details: unknown;
    source: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
    customer: { email: string | null } | null;
    order_items: Array<{
      order: { status: string; order_number: string; payments: Array<{ method_label: string | null; status: string }> } | null;
    }>;
  };
};

/**
 * Everything the Front Desk grid needs for one hotel and one visible date
 * window: room types with per-date capacity/availability/price (the header
 * row, sourced from the same hotel_availability RPC the allocator uses),
 * their physical units, booking bars assigned to those units, and any
 * disabled date ranges. A booking with no row in hotel_booking_room_units
 * yet simply doesn't appear as a bar — see unassignedCount — that's an
 * honest gap to surface, not something to paper over with a guessed room.
 */
export async function getFrontDeskBoard(hotelId: string, startDate: string, days: 7 | 14) {
  const supabase = await createClient();
  const endDateExclusive = addDays(startDate, days);
  const lastVisibleDate = addDays(startDate, days - 1);
  const today = new Date().toISOString().slice(0, 10);

  const [roomTypeAvailability, { data: roomTypeInfo }, { data: units }, { data: assignments }, { data: disabled }, { data: liveBookings }] =
    await Promise.all([
      getHotelAvailability(hotelId, { from: startDate, days }),
      supabase.from("hotel_rooms").select("id, base_price, currency").eq("hotel_id", hotelId),
      supabase
        .from("hotel_room_units")
        .select("id, room_type_id, room_number, floor, status")
        .eq("hotel_id", hotelId)
        .order("floor")
        .order("room_number"),
      supabase
        .from("hotel_booking_room_units")
        .select(
          `room_unit_id, locked,
           booking:hotel_bookings!inner(id, hotel_id, check_in, check_out, status, num_rooms, num_adults, num_children, total_price, special_requests, guest_details, source, checked_in_at, checked_out_at,
             customer:profiles!hotel_bookings_customer_id_fkey(email),
             order_items(order:orders(status, order_number, payments(method_label, status))))`
        )
        .eq("booking.hotel_id", hotelId)
        .lt("booking.check_in", endDateExclusive)
        .gt("booking.check_out", startDate),
      supabase
        .from("hotel_room_disable_dates")
        .select("room_unit_id, date_start, date_end, reason, hotel_room_units!inner(hotel_id)")
        .eq("hotel_room_units.hotel_id", hotelId)
        .lt("date_start", endDateExclusive)
        .gt("date_end", startDate),
      supabase
        .from("hotel_bookings")
        .select("id, hotel_booking_room_units(booking_id)")
        .eq("hotel_id", hotelId)
        .in("status", ["pending", "confirmed"])
        .lte("check_in", lastVisibleDate)
        .gte("check_out", startDate),
    ]);

  const assignedBookingIds = new Set((assignments ?? []).map((a) => (a as unknown as AssignmentRow).booking.id));
  const unassignedCount = (liveBookings ?? []).filter(
    (b) => !(b.hotel_booking_room_units as unknown[])?.length && !assignedBookingIds.has(b.id)
  ).length;

  const barsByUnit = new Map<string, FrontDeskBar[]>();
  for (const row of (assignments ?? []) as unknown as AssignmentRow[]) {
    const b = row.booking;
    const order = b.order_items?.[0]?.order;
    const succeededPayment = order?.payments?.find((p) => p.status === "succeeded");
    const bar: FrontDeskBar = {
      bookingId: b.id,
      bookingReference: order?.order_number ?? null,
      roomUnitId: row.room_unit_id,
      guestName: hotelGuestNames(b.guest_details)[0] ?? "Guest",
      // Desk bookings sit under the staff account; only a typed guest email belongs to the guest.
      guestEmail:
        (Array.isArray(b.guest_details) && typeof (b.guest_details[0] as { email?: unknown })?.email === "string"
          ? ((b.guest_details[0] as { email: string }).email || null)
          : null) ?? (b.source === "offline" ? null : (b.customer?.email ?? null)),
      checkIn: b.check_in,
      checkOut: b.check_out,
      status:
        b.status === "pending" || b.status === "confirmed"
          ? resolveFrontDeskStatus(b.status, b.check_in, b.check_out, b.checked_in_at, b.checked_out_at, today)
          : null,
      isGroupBooking: b.num_rooms > 1,
      paymentPending: order ? ["pending_payment", "held", "partially_paid"].includes(order.status) : false,
      paymentMethod: succeededPayment?.method_label ?? null,
      locked: row.locked,
      totalPrice: Number(b.total_price),
      numAdults: b.num_adults,
      numChildren: b.num_children,
      notes: b.special_requests,
    };
    if (!barsByUnit.has(row.room_unit_id)) barsByUnit.set(row.room_unit_id, []);
    barsByUnit.get(row.room_unit_id)!.push(bar);
  }

  const unitByRoomType = new Map<string, Array<{ id: string; room_number: string; floor: string | null; status: string }>>();
  for (const u of units ?? []) {
    if (!unitByRoomType.has(u.room_type_id)) unitByRoomType.set(u.room_type_id, []);
    unitByRoomType.get(u.room_type_id)!.push(u);
  }

  const infoByRoomType = new Map((roomTypeInfo ?? []).map((r) => [r.id, r]));

  const stayPrices = await getStayPrices(
    supabase,
    (roomTypeInfo ?? []).map((r) => ({ id: r.id, base_price: r.base_price })),
    startDate,
    endDateExclusive
  );

  const roomTypes: FrontDeskRoomType[] = roomTypeAvailability.map((rt) => {
    const info = infoByRoomType.get(rt.roomId);
    const rateByNight = new Map((stayPrices.get(rt.roomId)?.nights ?? []).map((n) => [n.night, n.rate]));
    return {
      id: rt.roomId,
      name: rt.roomName,
      currency: info?.currency ?? "USD",
      units: (unitByRoomType.get(rt.roomId) ?? []).map((u) => ({
        id: u.id,
        roomNumber: u.room_number,
        floor: u.floor,
        status: u.status,
      })),
      dates: rt.nights.map((n) => ({
        date: n.night,
        total: n.capacity ?? 0,
        available: n.available ?? 0,
        price: rateByNight.get(n.night) ?? n.priceOverride ?? Number(info?.base_price ?? 0),
      })),
    };
  });

  const disabledRanges: FrontDeskDisabledRange[] = (disabled ?? []).map((d) => ({
    roomUnitId: d.room_unit_id,
    dateStart: d.date_start,
    dateEnd: d.date_end,
    reason: d.reason,
  }));

  return {
    roomTypes,
    barsByUnit,
    disabledRanges,
    dateList: Array.from({ length: days }, (_, i) => addDays(startDate, i)),
    unassignedCount,
  };
}

/** Global stats strip for one date: arrivals, departures, occupied, total booked. */
export async function getFrontDeskDayStats(hotelId: string, date: string) {
  const supabase = await createClient();
  const [{ data: bookingRows }, { data: unitRows }, { data: disabledRows }] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select("id, check_in, check_out, checked_in_at, checked_out_at, status")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "confirmed"])
      .lte("check_in", date)
      .gte("check_out", date),
    supabase.from("hotel_room_units").select("id, status").eq("hotel_id", hotelId),
    supabase
      .from("hotel_room_disable_dates")
      .select("room_unit_id, hotel_room_units!inner(hotel_id)")
      .eq("hotel_room_units.hotel_id", hotelId)
      .lte("date_start", date)
      .gt("date_end", date),
  ]);

  const bookings = bookingRows ?? [];
  const units = unitRows ?? [];
  const standingOutOfOrder = new Set(units.filter((u) => u.status === "out_of_order").map((u) => u.id));
  const scheduledOutOfOrder = new Set((disabledRows ?? []).map((d) => d.room_unit_id));

  return {
    arrivals: bookings.filter((b) => b.check_in === date).length,
    departures: bookings.filter((b) => b.check_out === date).length,
    occupied: bookings.filter((b) => b.checked_in_at && !b.checked_out_at).length,
    totalBooked: bookings.length,
    totalRooms: units.length,
    outOfOrder: new Set([...standingOutOfOrder, ...scheduledOutOfOrder]).size,
  };
}
