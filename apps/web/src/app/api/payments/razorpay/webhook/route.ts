import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateways } from "@/lib/provider-runtime/payments";

/**
 * Razorpay webhook — settles card payments made through a payment link.
 * Point the endpoint at /api/payments/razorpay/webhook, enable the
 * payment_link.paid event, and save the webhook secret under Admin >
 * Integrations > Payments. Without a secret the route refuses to process
 * events rather than trusting unverified input.
 */
export async function POST(request: Request) {
  const secret = (await getPaymentGateways()).razorpay?.webhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const valid = expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    event: string;
    payload?: { payment_link?: { entity?: { id?: string; notes?: Record<string, string> } } };
  };

  if (event.event === "payment_link.paid") {
    const link = event.payload?.payment_link?.entity;
    const admin = createAdminClient();
    const paymentId = link?.notes?.payment_id;
    const topupId = link?.notes?.topup_id;

    if (paymentId) {
      await admin.from("payments").update({ status: "succeeded", provider_ref: link?.id }).eq("id", paymentId);
    }

    // Wallet funding settles the same way; settle_agency_topup is idempotent,
    // so a redelivered event never credits the wallet twice.
    if (topupId) {
      await admin.rpc("settle_agency_topup", { p_request_id: topupId, p_provider_ref: link?.id ?? "" });
    }
  }

  return NextResponse.json({ received: true });
}
