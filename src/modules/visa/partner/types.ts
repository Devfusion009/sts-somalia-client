import type { ApplicationDetail } from "@/modules/visa/queries";

/**
 * What an adapter needs to hand an application to a partner. Built from the
 * same ApplicationDetail shape the admin visa detail page already loads —
 * no bespoke query for the partner path.
 */
export type PartnerSubmissionInput = {
  application: ApplicationDetail;
};

export type PartnerSubmissionResult =
  | { type: "submitted"; partnerRef: string; status?: string }
  | { type: "error"; message: string };

export type PartnerStatusResult =
  | { type: "status"; status: string; raw?: unknown }
  | { type: "error"; message: string };
