import type { BadgeVariant } from "@/components/ui/badge";
import type { Database } from "@/lib/types/database.types";

export type UmrahStage = Database["public"]["Enums"]["umrah_fulfillment_stage"];

/** Enum order — the RPC compares stages by this order, so it is the forward direction too. */
export const UMRAH_STAGES: UmrahStage[] = [
  "booked",
  "confirmed",
  "visa_processing",
  "visa_issued",
  "travel_confirmed",
  "documents_ready",
  "completed",
];

export const UMRAH_STAGE_LABELS: Record<UmrahStage, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  visa_processing: "Visa processing",
  visa_issued: "Visa issued",
  travel_confirmed: "Travel confirmed",
  documents_ready: "Documents ready",
  completed: "Completed",
};

/** Badge variant per stage: in-flight stages read as info, the visa wait as warning, the end state as success. */
export const UMRAH_STAGE_VARIANTS: Record<UmrahStage, BadgeVariant> = {
  booked: "neutral",
  confirmed: "info",
  visa_processing: "warning",
  visa_issued: "info",
  travel_confirmed: "info",
  documents_ready: "info",
  completed: "success",
};

export const UMRAH_DOC_TYPES = ["visa", "e_ticket", "hotel_voucher", "itinerary", "insurance", "other"] as const;
export type UmrahDocType = (typeof UMRAH_DOC_TYPES)[number];

export const UMRAH_DOC_TYPE_LABELS: Record<UmrahDocType, string> = {
  visa: "Visa",
  e_ticket: "E-ticket",
  hotel_voucher: "Hotel voucher",
  itinerary: "Itinerary",
  insurance: "Insurance",
  other: "Other",
};

export function isUmrahStage(value: string | undefined): value is UmrahStage {
  return !!value && (UMRAH_STAGES as string[]).includes(value);
}

export function isPaidOrderStatus(status: string | null | undefined) {
  return status === "paid" || status === "partially_paid" || status === "processing" || status === "completed";
}

/** Payment badge variant for an order status on Umrah screens. */
export function orderStatusVariant(status: string): BadgeVariant {
  if (isPaidOrderStatus(status)) return status === "partially_paid" ? "warning" : "success";
  if (status === "cancelled") return "destructive";
  if (status === "refunded") return "neutral";
  return "warning";
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  partially_paid: "Partially paid",
  paid: "Paid",
  processing: "Paid",
  completed: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
