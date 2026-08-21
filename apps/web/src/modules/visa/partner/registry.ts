import "server-only";
import { submitToManualPartner, syncManualPartnerStatus } from "./adapters/manual";
import type { PartnerSubmissionInput, PartnerSubmissionResult, PartnerStatusResult } from "./types";

/**
 * Dispatches by provider key, same shape as initiateWithProvider() in
 * payments/providers.ts. "manual" is always available (no credentials, no
 * platform_api_integrations row needed) — the same way payments' bank
 * transfer / cash-at-office methods are always available regardless of which
 * gateways are configured. A real partner is added here as one more case
 * once STS signs with one; nothing upstream (admin actions, DB columns,
 * webhook route) changes.
 */
export async function submitToPartner(
  providerKey: string,
  input: PartnerSubmissionInput
): Promise<PartnerSubmissionResult> {
  switch (providerKey) {
    case "manual":
      return submitToManualPartner(input);
    default:
      return { type: "error", message: `No visa-processing partner is wired up for "${providerKey}" yet.` };
  }
}

export async function syncPartnerStatus(providerKey: string, _partnerRef: string): Promise<PartnerStatusResult> {
  switch (providerKey) {
    case "manual":
      return syncManualPartnerStatus();
    default:
      return { type: "error", message: `No visa-processing partner is wired up for "${providerKey}" yet.` };
  }
}
