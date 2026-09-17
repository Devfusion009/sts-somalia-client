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

export const UMRAH_STAGE_STYLES: Record<UmrahStage, string> = {
  booked: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  visa_processing: "bg-brand-gold/15 text-brand-gold",
  visa_issued: "bg-primary/10 text-primary",
  travel_confirmed: "bg-primary/10 text-primary",
  documents_ready: "bg-primary/10 text-primary",
  completed: "bg-primary text-primary-foreground",
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

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  partially_paid: "Partially paid",
  paid: "Paid",
  processing: "Paid",
  completed: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
