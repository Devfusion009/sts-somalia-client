import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Guest = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  channel: "online" | "agency" | "offline";
  stays: number;
  cancelled: number;
  noShows: number;
  roomNights: number;
  totalSpent: number;
  currency: string;
  firstStay: string | null;
  lastStay: string | null;
  nextArrival: string | null;
  bookingIds: string[];
};

/** One row per guest of this hotel, most recent stay first (see hotel_guest_directory). */
export async function getGuestDirectory(hotelId: string): Promise<Guest[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("hotel_guest_directory", { p_hotel_id: hotelId });
  return (data ?? []).map((g) => ({
    key: g.guest_key,
    name: g.full_name,
    email: g.email,
    phone: g.phone,
    channel: g.channel === "online" || g.channel === "agency" ? g.channel : "offline",
    stays: g.stays,
    cancelled: g.cancelled,
    noShows: g.no_shows,
    roomNights: g.room_nights,
    totalSpent: Number(g.total_spent),
    currency: g.currency,
    firstStay: g.first_stay,
    lastStay: g.last_stay,
    nextArrival: g.next_arrival,
    bookingIds: g.booking_ids,
  }));
}

export type GuestBooking = {
  id: string;
  roomName: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  numRooms: number;
  totalPrice: number;
  currency: string;
  paid: boolean;
};

export async function getGuestBookings(hotelId: string, bookingIds: string[]): Promise<GuestBooking[]> {
  if (bookingIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_bookings")
    .select("id, status, check_in, check_out, num_rooms, total_price, currency, paid_at, room:hotel_rooms(name)")
    .eq("hotel_id", hotelId)
    .in("id", bookingIds.slice(0, 200))
    .order("check_in", { ascending: false });
  return (data ?? []).map((b) => ({
    id: b.id,
    roomName: b.room?.name ?? null,
    status: b.status,
    checkIn: b.check_in,
    checkOut: b.check_out,
    numRooms: b.num_rooms,
    totalPrice: Number(b.total_price),
    currency: b.currency,
    paid: b.paid_at !== null,
  }));
}
