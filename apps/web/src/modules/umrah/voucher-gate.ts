/**
 * One rule for the voucher and the itinerary PDF, shared by the download
 * routes and both booking pages: the order is fully paid, and an Umrah
 * booking has reached 'travel_confirmed' (flights and hotels are final).
 */
const PAID = ["paid", "processing", "completed"];
const STAGES_WITH_TRAVEL = ["travel_confirmed", "documents_ready", "completed"];

export function umrahVoucherAvailable(orderStatus: string, umrahStage?: string | null) {
  if (!PAID.includes(orderStatus)) return false;
  if (umrahStage === undefined) return true;
  return !!umrahStage && STAGES_WITH_TRAVEL.includes(umrahStage);
}
