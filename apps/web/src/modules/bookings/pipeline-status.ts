/**
 * The customer-facing pipeline the client asked for — Pending → Payment
 * Received → Confirmed → Completed/Cancelled — computed from the existing
 * order_status + booking_status pair rather than stored as a new column, so
 * it can never drift out of sync with the two statuses that already govern
 * money and fulfillment (same "compute, don't duplicate" approach used for
 * order partial-payment rollup).
 */
export type PipelineStatus = "Pending" | "Payment Received" | "Confirmed" | "Completed" | "Cancelled";

const TERMINAL_CANCELLED = new Set(["cancelled", "refunded", "failed", "no_show"]);

export function pipelineStatus(
  orderStatus: string | null | undefined,
  bookingStatus: string
): PipelineStatus {
  if (TERMINAL_CANCELLED.has(bookingStatus)) return "Cancelled";
  if (bookingStatus === "completed") return "Completed";
  if (bookingStatus === "confirmed") return "Confirmed";
  if (orderStatus === "paid" || orderStatus === "partially_paid") return "Payment Received";
  return "Pending";
}

export const PIPELINE_STATUS_STYLES: Record<PipelineStatus, string> = {
  Pending: "bg-brand-gold/15 text-brand-gold",
  "Payment Received": "bg-chart-3/10 text-chart-3",
  Confirmed: "bg-primary/10 text-primary",
  Completed: "bg-primary/10 text-primary",
  Cancelled: "bg-destructive/10 text-destructive",
};
