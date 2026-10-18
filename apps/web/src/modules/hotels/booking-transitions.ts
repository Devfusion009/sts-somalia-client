/**
 * Which status a hotel booking may move to next. One rule set for the admin
 * queue, the partner console and the manager console, so none of them offers
 * a move the others refuse (a free status dropdown let a request jump from
 * pending straight to completed, or reopen a cancelled stay).
 *
 * waitlisted is never a choice: the allocator parks and promotes rows itself.
 * Refunds and failures belong to the payment flow, not to this control.
 */
export type HotelBookingStatus =
  | "pending"
  | "waitlisted"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "refunded"
  | "failed";

export type HotelBookingMove = "confirmed" | "completed" | "no_show" | "cancelled";

/**
 * Moves available now. A guest who has checked in can only have the stay
 * completed; before check-in, no-show needs the arrival date to have come.
 */
export function nextHotelBookingMoves(
  status: string,
  checkIn: string,
  today: string,
  checkedIn = false
): HotelBookingMove[] {
  switch (status) {
    case "pending":
    case "waitlisted":
      return ["confirmed", "cancelled"];
    case "confirmed":
      if (checkedIn) return ["completed"];
      return checkIn <= today ? ["no_show", "cancelled"] : ["cancelled"];
    default:
      return [];
  }
}
