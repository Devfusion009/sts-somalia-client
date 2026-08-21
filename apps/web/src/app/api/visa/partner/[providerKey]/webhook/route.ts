import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveProviderCredentials } from "@/lib/provider-runtime/credentials";
import type { Json } from "@/lib/types/database.types";

/**
 * Skeleton receiver for a real visa-processing partner's status webhooks —
 * not wired to any vendor's actual payload yet (none is chosen). Mirrors
 * /api/payments/stripe/webhook's shape (raw-body read, shared-secret HMAC
 * verification, service-role update) so hooking up a real partner later is
 * "fill in this vendor's header name and payload fields," not "build a
 * webhook receiver from scratch."
 *
 * Expected credential field once a partner is configured (via the same
 * admin provider-catalog flow as every other integration):
 *   webhook_secret — shared secret used to HMAC-sign the payload.
 * Expected payload shape (adjust to match the real vendor):
 *   { partner_ref: string, status: string, raw?: unknown }
 */
export async function POST(request: Request, { params }: { params: Promise<{ providerKey: string }> }) {
  const { providerKey } = await params;
  const credentials = await getActiveProviderCredentials(providerKey);
  const secret = credentials?.webhook_secret;
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

  const event = JSON.parse(payload) as { partner_ref?: string; status?: string; raw?: unknown };
  if (event.partner_ref && event.status) {
    const admin = createAdminClient();
    await admin
      .from("visa_applications")
      .update({
        partner_status: event.status,
        partner_raw_payload: JSON.parse(JSON.stringify(event.raw ?? event)) as Json,
        partner_last_synced_at: new Date().toISOString(),
      })
      .eq("partner_provider_key", providerKey)
      .eq("partner_ref", event.partner_ref);
  }

  return NextResponse.json({ received: true });
}
