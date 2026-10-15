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

/** Moves available now. Completing or no-showing a stay needs the stay to have begun. */
export function nextHotelBookingMoves(
  status: string,
  checkIn: string,
  today: string
): HotelBookingMove[] {
  switch (status) {
    case "pending":
    case "waitlisted":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return checkIn <= today ? ["completed", "no_show", "cancelled"] : ["cancelled"];
    default:
      return [];
  }
}
