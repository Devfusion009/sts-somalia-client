/**
 * Which status a hall booking may move to next — the same rules the database
 * enforces in hall_bookings_status_guard, so no console offers a move the
 * database would refuse. waitlisted is never a choice: the allocator parks
 * and promotes requests itself.
 */
export type HallBookingMove = "confirmed" | "cancelled" | "completed" | "no_show" | "refunded";

export const HALL_MOVE_LABEL: Record<HallBookingMove, string> = {
  confirmed: "Confirm",
  cancelled: "Cancel",
  completed: "Complete",
  no_show: "No-show",
  refunded: "Mark refunded",
};

export function nextHallBookingMoves(
  b: { status: string; start_date: string; end_date: string; price: number | string },
  today: string,
  isAdmin = false
): HallBookingMove[] {
  switch (b.status) {
    case "pending":
    case "waitlisted":
      return b.end_date >= today ? ["confirmed", "cancelled"] : ["cancelled"];
    case "confirmed": {
      const moves: HallBookingMove[] = [];
      if (today >= b.start_date) moves.push("completed", "no_show");
      if (today <= b.end_date) moves.push("cancelled");
      return moves;
    }
    case "cancelled":
      return isAdmin ? ["refunded"] : [];
    default:
      return [];
  }
}
