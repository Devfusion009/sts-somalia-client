import type {
  PartnerSubmissionInput,
  PartnerSubmissionResult,
  PartnerStatusResult,
  PartnerStatusMapResult,
} from "../types";

/**
 * A real vendor implemented entirely in-process, no network, no credentials.
 * This is how the partner path gets exercised and demoed before any real
 * vendor exists — the contract's proof that it actually works, not just that
 * it compiles. Enable it by setting a visa type's partner_provider_key to
 * "sandbox" with processing_mode "partner".
 *
 * The sequence is intentionally short and linear: submit lands the
 * application in our 'processing' status (the admin action does that, not
 * this adapter), then two syncs carry it to a decision and issuance. Every
 * step in SEQUENCE must be a legal edge in apply_visa_status_transition_
 * internal's transition map — the sandbox exists to prove the contract
 * works end to end, not to explore edge cases.
 */
const SEQUENCE = ["authority_approved", "visa_ready"] as const;

export async function submitToSandboxPartner(input: PartnerSubmissionInput): Promise<PartnerSubmissionResult> {
  return { type: "submitted", partnerRef: `sandbox:${input.application.id}`, status: "submitted" };
}

/** Advances one step from whatever status was last recorded. Plateaus at the end — a redelivered/re-polled sync stays put, it doesn't loop. */
export async function syncSandboxPartnerStatus(
  _partnerRef: string,
  previousStatus: string | null
): Promise<PartnerStatusResult> {
  const currentIndex = SEQUENCE.indexOf((previousStatus ?? "") as (typeof SEQUENCE)[number]);
  const nextIndex = Math.min(currentIndex + 1, SEQUENCE.length - 1);
  return { type: "status", status: SEQUENCE[nextIndex], raw: { simulated: true, step: nextIndex } };
}

export function mapSandboxStatus(vendorStatus: string): PartnerStatusMapResult {
  switch (vendorStatus) {
    case "authority_approved":
      return { type: "mapped", status: "approved" };
    case "visa_ready":
      return { type: "mapped", status: "issued" };
    default:
      return { type: "unmapped" };
  }
}
