import { FileText, Landmark, Plane, Send, Ticket, Users } from "lucide-react";
import type { TimelineStage } from "@/modules/bookings/components/status-timeline";

export { UMRAH_STAGE_LABEL, UMRAH_DOC_TYPE_LABEL, type UmrahFulfillmentStage } from "@sts/shared-types";
import type { UmrahFulfillmentStage } from "@sts/shared-types";

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
