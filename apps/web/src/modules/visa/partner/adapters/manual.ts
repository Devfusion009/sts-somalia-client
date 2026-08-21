import type { PartnerSubmissionInput, PartnerSubmissionResult, PartnerStatusResult } from "../types";

/**
 * The only adapter shipped until STS actually signs with a visa-processing
 * partner. There's no HTTP API to call yet, so "submitting" just records
 * that staff have taken the application outside the system (phone/email/
 * partner portal) — same handoff STS already does today, just tracked
 * through the same partner_ref/partner_status columns a real adapter will
 * use, so swapping one in later doesn't change anything upstream of it.
 */
export async function submitToManualPartner(input: PartnerSubmissionInput): Promise<PartnerSubmissionResult> {
  return {
    type: "submitted",
    partnerRef: `manual:${input.application.id}`,
    status: "handed_off",
  };
}

export async function syncManualPartnerStatus(): Promise<PartnerStatusResult> {
  return { type: "error", message: "This partner has no live status API — update the application's status manually as staff hear back." };
}
