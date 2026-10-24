import type { BadgeVariant } from "@/components/ui/badge";

/** Application review states -> Badge variant, shared by the queue and the detail page. */
export const APPLICATION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warning",
  under_review: "info",
  more_info_requested: "neutral",
  approved: "success",
  rejected: "destructive",
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  more_info_requested: "Awaiting applicant",
  approved: "Approved",
  rejected: "Rejected",
};

export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}
