import "server-only";
import { getActiveProviderCredentials, getActiveProviderConfig } from "@/lib/provider-runtime/credentials";
import { submitToSandboxPartner, syncSandboxPartnerStatus, mapSandboxStatus } from "./adapters/sandbox";
import { submitToCustomPartner, syncCustomPartnerStatus, mapCustomStatus } from "./adapters/custom";
import type {
  PartnerSubmissionInput,
  PartnerSubmissionResult,
  PartnerStatusResult,
  PartnerStatusMapResult,
} from "./types";

/**
 * Dispatches by provider key, same shape as initiateWithProvider() in
 * payments/providers.ts. A real vendor with a bespoke API still gets a real
 * adapter file added here as one more case; a real vendor with an ordinary
 * REST + webhook API can instead be wired up entirely through the "custom"
 * case below, configured by an admin — see adapters/custom.ts. Either way,
 * nothing upstream (admin actions, DB columns, webhook route) changes.
 *
 * There is no "manual" case here (there was, briefly, before the manual
 * embassy workspace existed — see visa_processing_jobs / admin-actions.ts's
 * adminStartManualProcessing). Manual processing is not a fake partner
 * pretending to submit somewhere; it is staff recording where they actually
 * lodged the application. Routing it through this switch would have meant
 * two different code paths both claiming to be "the manual option."
 */
export async function submitToPartner(
  providerKey: string,
  input: PartnerSubmissionInput
): Promise<PartnerSubmissionResult> {
  switch (providerKey) {
    case "sandbox":
      return submitToSandboxPartner(input);
    case "custom": {
      const active = await getActiveProviderConfig(providerKey);
      if (!active) return { type: "error", message: "The custom partner has no active configuration." };
      return submitToCustomPartner(input, active.config, active.credentials);
    }
    default:
      return { type: "error", message: `No visa-processing partner is wired up for "${providerKey}" yet.` };
  }
}

export async function syncPartnerStatus(
  providerKey: string,
  partnerRef: string,
  previousStatus: string | null
): Promise<PartnerStatusResult> {
  switch (providerKey) {
    case "sandbox":
      return syncSandboxPartnerStatus(partnerRef, previousStatus);
    case "custom": {
      const active = await getActiveProviderConfig(providerKey);
      if (!active) return { type: "error", message: "The custom partner has no active configuration." };
      return syncCustomPartnerStatus(partnerRef, active.config, active.credentials);
    }
    default:
      return { type: "error", message: `No visa-processing partner is wired up for "${providerKey}" yet.` };
  }
}

/**
 * How one vendor status maps onto our own — the piece that makes a partner's
 * push (webhook) and an admin's manual pull agree on what happened. Called
 * by both; neither re-implements the mapping. Async because "custom"'s map
 * is admin-configured data, not code — it has to be read from the database.
 */
export async function mapPartnerStatus(providerKey: string, vendorStatus: string): Promise<PartnerStatusMapResult> {
  switch (providerKey) {
    case "sandbox":
      return mapSandboxStatus(vendorStatus);
    case "custom": {
      const active = await getActiveProviderConfig(providerKey);
      if (!active) return { type: "unmapped" };
      return mapCustomStatus(vendorStatus, active.config);
    }
    default:
      return { type: "unmapped" };
  }
}

/**
 * Whether a provider is actually usable right now — configured and active in
 * platform_api_integrations, the same source of truth getActiveProviderCredentials
 * reads. Lets the admin UI show "not configured" instead of an actionable
 * button that would only fail once clicked.
 */
export async function isPartnerProviderAvailable(providerKey: string): Promise<boolean> {
  return (await getActiveProviderCredentials(providerKey)) !== null;
}
