import { FileText, Landmark, Plane, Send, Ticket, Users } from "lucide-react";
import type { TimelineStage } from "@/modules/bookings/components/status-timeline";

export type UmrahFulfillmentStage =
  | "booked"
  | "confirmed"
  | "visa_processing"
  | "visa_issued"
  | "travel_confirmed"
  | "documents_ready"
  | "completed";

export const UMRAH_STAGE_LABEL: Record<UmrahFulfillmentStage, string> = {
  booked: "Booking received",
  confirmed: "Confirmed",
  visa_processing: "Visa processing",
  visa_issued: "Visa issued",
  travel_confirmed: "Travel confirmed",
  documents_ready: "Documents ready",
  completed: "Completed",
};

export const UMRAH_DOC_TYPE_LABEL: Record<string, string> = {
  visa: "Visa",
  e_ticket: "E-ticket",
  hotel_voucher: "Hotel voucher",
  itinerary: "Itinerary",
  insurance: "Insurance",
  other: "Document",
};

/**
 * Seven fulfillment stages on a six-step track: visa_processing and
 * visa_issued share the Visa step, told apart by its sub-label. The booking
 * status only overrides the stage when the booking ended badly.
 */
export function umrahTimeline(
  stage: UmrahFulfillmentStage | null | undefined,
  status: string
): { stages: TimelineStage[]; index: number; outcome: "pending" | "success" | "failed" } {
  const stages: TimelineStage[] = [
    { key: "booked", label: "Booking received", icon: Send },
    { key: "confirmed", label: "Confirmed", icon: Users },
    {
      key: "visa",
      label: "Visa",
      description:
        stage === "visa_processing" ? "Processing" : stage === "visa_issued" ? "Issued" : undefined,
      icon: FileText,
    },
    { key: "travel", label: "Travel confirmed", icon: Plane },
    { key: "documents", label: "Documents ready", icon: Ticket },
    { key: "completed", label: "Completed", icon: Landmark },
  ];
  const last = stages.length - 1;

  if (["cancelled", "refunded", "no_show", "failed"].includes(status)) {
    return { stages, index: last, outcome: "failed" };
  }

  const effective: UmrahFulfillmentStage =
    stage ?? (status === "completed" ? "completed" : status === "confirmed" ? "confirmed" : "booked");
  const index: Record<UmrahFulfillmentStage, number> = {
    booked: 0,
    confirmed: 1,
    visa_processing: 2,
    visa_issued: 2,
    travel_confirmed: 3,
    documents_ready: 4,
    completed: 5,
  };
  if (effective === "completed" || status === "completed") {
    return { stages, index: last, outcome: "success" };
  }
  return { stages, index: index[effective], outcome: "pending" };
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
