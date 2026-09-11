import "server-only";
import { assertSafeExternalUrl } from "@/lib/safe-fetch";
import { getPath, interpolate, buildApplicationContext } from "../template";
import type {
  PartnerSubmissionInput,
  PartnerSubmissionResult,
  PartnerStatusResult,
  PartnerStatusMapResult,
  VisaStatus,
} from "../types";

/**
 * The only vendor-agnostic way to add a real visa-processing partner without
 * writing and deploying a new adapter file: an admin fills in a REST
 * request/response shape through the Integrations page, stored as
 * platform_api_integrations.config, and this executes it generically.
 * Proven end to end against a real HTTP endpoint (see
 * VISA-MODULE-BUILD-SPEC.md's M8 note) rather than against guessed vendor
 * documentation — genuinely vendor-agnostic, not "VisaHQ pretending to be
 * generic."
 *
 * Config shape (all under platform_api_integrations.config for provider_key
 * "custom"):
 *   submit: { url, method?, bodyTemplate?, refPath, statusPath? }
 *   sync?:  { urlTemplate, method?, statusPath }        — {{ref}} in the URL
 *   webhook?: { refField, statusField }                 — payload field names
 *   statusMap: { [vendorStatus]: VisaStatus }
 *
 * Credentials (platform_api_integrations.credentials_encrypted):
 *   auth_header_name?, auth_header_value?  — sent on every outbound call
 *   webhook_secret                         — HMAC signing, same as sandbox
 */

const VALID_VISA_STATUSES: readonly VisaStatus[] = [
  "draft",
  "submitted",
  "in_review",
  "additional_info_required",
  "ready_for_processing",
  "processing",
  "approved",
  "rejected",
  "issued",
  "cancelled",
];

type CustomConfig = {
  submit?: { url?: string; method?: string; bodyTemplate?: unknown; refPath?: string; statusPath?: string };
  sync?: { urlTemplate?: string; method?: string; statusPath?: string };
  webhook?: { refField?: string; statusField?: string };
  statusMap?: Record<string, string>;
};

function authHeaders(credentials: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (credentials.auth_header_name && credentials.auth_header_value) {
    headers[credentials.auth_header_name] = credentials.auth_header_value;
  }
  return headers;
}

export async function submitToCustomPartner(
  input: PartnerSubmissionInput,
  config: CustomConfig,
  credentials: Record<string, string>
): Promise<PartnerSubmissionResult> {
  const submit = config.submit;
  if (!submit?.url || !submit.refPath) {
    return { type: "error", message: "This partner has no submit request configured yet." };
  }

  const context = buildApplicationContext(input.application);
  const body = submit.bodyTemplate ? interpolate(submit.bodyTemplate, context) : undefined;

  let response: Response;
  try {
    await assertSafeExternalUrl(submit.url);
    response = await fetch(submit.url, {
      method: submit.method ?? "POST",
      headers: authHeaders(credentials),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "Request to partner failed." };
  }

  if (!response.ok) {
    return { type: "error", message: `Partner returned ${response.status} ${response.statusText}.` };
  }

  const json = await response.json().catch(() => null);
  const ref = getPath(json, submit.refPath);
  if (typeof ref !== "string" && typeof ref !== "number") {
    return { type: "error", message: `Partner response had no value at "${submit.refPath}".` };
  }

  const status = submit.statusPath ? getPath(json, submit.statusPath) : undefined;
  return { type: "submitted", partnerRef: String(ref), status: typeof status === "string" ? status : undefined };
}

export async function syncCustomPartnerStatus(
  partnerRef: string,
  config: CustomConfig,
  credentials: Record<string, string>
): Promise<PartnerStatusResult> {
  const sync = config.sync;
  if (!sync?.urlTemplate || !sync.statusPath) {
    return { type: "error", message: "This partner has no status sync configured — update its status manually." };
  }

  const url = interpolate(sync.urlTemplate, { ref: partnerRef }) as string;

  let response: Response;
  try {
    await assertSafeExternalUrl(url);
    response = await fetch(url, { method: sync.method ?? "GET", headers: authHeaders(credentials) });
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "Request to partner failed." };
  }

  if (!response.ok) {
    return { type: "error", message: `Partner returned ${response.status} ${response.statusText}.` };
  }

  const json = await response.json().catch(() => null);
  const status = getPath(json, sync.statusPath);
  if (typeof status !== "string") {
    return { type: "error", message: `Partner response had no value at "${sync.statusPath}".` };
  }
  return { type: "status", status, raw: json };
}

/**
 * "Test connection" for the custom adapter's config, called from the admin
 * Integrations page. Doesn't submit anything real — there is no application
 * to submit in this context, and firing a request at the vendor here would
 * create a real record on their side purely from a config-check click.
 * Confirms the shape is complete and the submit URL is safe to reach.
 */
export async function testCustomPartnerConfig(
  credentials: Record<string, string>,
  config: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  const submit = (config as CustomConfig).submit;
  if (!submit?.url || !submit.refPath) {
    return { ok: false, message: "Set a submit URL and a response reference path first." };
  }
  try {
    await assertSafeExternalUrl(submit.url);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "That submit URL isn't safe to call." };
  }
  if (!credentials.webhook_secret) {
    return { ok: false, message: "Set a webhook secret so status pushes can be verified." };
  }
  return { ok: true, message: "Configuration looks complete. Submit a real application to fully verify it." };
}

export function mapCustomStatus(vendorStatus: string, config: CustomConfig): PartnerStatusMapResult {
  const mapped = config.statusMap?.[vendorStatus];
  if (mapped && (VALID_VISA_STATUSES as readonly string[]).includes(mapped)) {
    return { type: "mapped", status: mapped as VisaStatus };
  }
  return { type: "unmapped" };
}
