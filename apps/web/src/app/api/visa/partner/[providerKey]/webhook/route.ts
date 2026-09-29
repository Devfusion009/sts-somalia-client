import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyVisaCustomer } from "@/modules/visa/notify";
import { getActiveProviderConfig } from "@/lib/provider-runtime/credentials";
import { mapPartnerStatus } from "@/modules/visa/partner/registry";
import { parkForUnmappedPartnerStatus, parkForRefusedPartnerTransition } from "@/modules/visa/partner/sync";
import { getPath } from "@/modules/visa/partner/template";
import type { Json } from "@/lib/types/database.types";

/**
 * Receiver for a visa-processing partner's status webhooks. Verified against
 * the sandbox adapter (modules/visa/partner/adapters/sandbox.ts) end to end
 * — HMAC, application lookup, mapping, idempotent replay — before any real
 * vendor exists.
 *
 * Payload field NAMES are admin-configurable (platform_api_integrations.
 * config.webhook.refField/statusField) so a real vendor's webhook shape
 * doesn't need a code change here either — only sandbox's fixed
 * `partner_ref`/`status` names are hardcoded as the default, since sandbox
 * has no config row.
 *
 * Idempotency has no separate mechanism (no delivery-id ledger): a
 * redelivered payload reports the same vendor status as last time, and
 * apply_visa_status_transition_internal already no-ops when asked to set a
 * status the application is already at. That is the same guarantee every
 * other status-changing path in this codebase relies on, not a webhook-
 * specific special case.
 *
 * Credential field: webhook_secret — shared secret used to HMAC-sign the
 * payload (header: x-webhook-signature, hex-encoded HMAC-SHA256 of the raw
 * body).
 */
export async function POST(request: Request, { params }: { params: Promise<{ providerKey: string }> }) {
  const { providerKey } = await params;
  const active = await getActiveProviderConfig(providerKey);
  const secret = active?.credentials.webhook_secret;
  if (!secret) {
    return NextResponse.json({ error: "This partner has no webhook configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookConfig = active.config.webhook as { refField?: string; statusField?: string } | undefined;
  const refField = webhookConfig?.refField ?? "partner_ref";
  const statusField = webhookConfig?.statusField ?? "status";
  const partnerRef = getPath(body, refField);
  const status = getPath(body, statusField);
  if (typeof partnerRef !== "string" && typeof partnerRef !== "number") {
    return NextResponse.json({ error: `Payload had no value at "${refField}"` }, { status: 400 });
  }
  if (typeof status !== "string") {
    return NextResponse.json({ error: `Payload had no value at "${statusField}"` }, { status: 400 });
  }
  const partnerRefStr = String(partnerRef);

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("visa_applications")
    .select("id, application_ref, partner_status")
    .eq("partner_provider_key", providerKey)
    .eq("partner_ref", partnerRefStr)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "No application matches this partner reference" }, { status: 404 });
  }

  const rawPayload = JSON.parse(JSON.stringify(body)) as Json;
  await admin
    .from("visa_applications")
    .update({ partner_status: status, partner_raw_payload: rawPayload, partner_last_synced_at: new Date().toISOString() })
    .eq("id", application.id);
  await admin
    .from("visa_processing_jobs")
    .update({ partner_status: status, partner_raw_payload: rawPayload, partner_last_synced_at: new Date().toISOString() })
    .eq("application_id", application.id)
    .eq("status", "active")
    .eq("route", "partner");

  if (status !== application.partner_status) {
    const mapped = await mapPartnerStatus(providerKey, status);
    if (mapped.type === "mapped") {
      const { error: transitionError } = await admin.rpc("apply_visa_partner_status_update", {
        p_application_id: application.id,
        p_status: mapped.status,
      });
      if (!transitionError && (mapped.status === "approved" || mapped.status === "rejected")) {
        await notifyVisaCustomer(
          application.id,
          "decision_recorded",
          mapped.status === "approved" ? "Your visa was approved." : "Your visa application was refused."
        );
      }
      if (transitionError) {
        await parkForRefusedPartnerTransition(
          admin,
          application.id,
          application.application_ref,
          providerKey,
          status,
          transitionError.message
        );
      }
    } else {
      await parkForUnmappedPartnerStatus(admin, application.id, application.application_ref, providerKey, status);
    }
  }

  return NextResponse.json({ received: true });
}
