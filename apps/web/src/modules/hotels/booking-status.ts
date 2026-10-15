import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/modules/hotels/availability";
import { nextHotelBookingMoves, type HotelBookingMove } from "@/modules/hotels/booking-transitions";

/**
 * The single write path for a hotel booking's status, shared by the admin
 * queue and the partner / manager consoles. Callers authorize first; this
 * enforces the move itself. Closing the loop on a decline (cancelling the
 * unpaid order, telling the guest) is the database's job — see
 * hotel_booking_decided() — so it holds on every path.
 */
export async function applyHotelBookingMove(
  bookingId: string,
  next: HotelBookingMove
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("hotel_bookings")
    .select("id, status, check_in, total_price")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking not found." };

  if (!nextHotelBookingMoves(booking.status, booking.check_in, todayIso()).includes(next)) {
    return { error: `A ${booking.status.replace(/_/g, " ")} booking can't be changed to ${next.replace(/_/g, " ")}.` };
  }
  if (next === "confirmed" && Number(booking.total_price) <= 0) {
    return { error: "Price not set." };
  }

  // Match on the status just read: a decision someone else made in between
  // is reported instead of silently overwritten.
  const { data: updated, error } = await supabase
    .from("hotel_bookings")
    .update({ status: next })
    .eq("id", bookingId)
    .eq("status", booking.status)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "This booking was just changed. Refresh and try again." };
  return { error: null };
}
