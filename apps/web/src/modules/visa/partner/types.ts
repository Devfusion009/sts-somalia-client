import type { ApplicationDetail } from "@/modules/visa/queries";
import type { Database } from "@/lib/types/database.types";

export type VisaStatus = Database["public"]["Enums"]["visa_status"];

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

/**
 * How one vendor status string maps onto our own status. "unmapped" is not
 * an error — a vendor adds a status we've never seen, or sends one that
 * doesn't correspond to a decision at all (e.g. an internal queue position)
 * — and the honest response is to park the application for a human to look
 * at, not guess.
 */
export type PartnerStatusMapResult = { type: "mapped"; status: VisaStatus } | { type: "unmapped" };
