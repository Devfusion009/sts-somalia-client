import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateways } from "@/lib/provider-runtime/payments";

/**
 * Stripe webhook — settles card payments. Configure the endpoint in the
 * Stripe dashboard pointing at /api/payments/stripe/webhook and save the
 * signing secret under Admin > Integrations > Payments (STRIPE_WEBHOOK_SECRET
 * still works as a fallback); without a secret the route refuses to process
 * events rather than trusting unverified input.
 */
export async function POST(request: Request) {
  const secret = (await getPaymentGateways()).stripe?.webhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; metadata?: Record<string, string> } };
  };

  if (event.type === "checkout.session.completed") {
    const admin = createAdminClient();
    const paymentId = event.data.object.metadata?.payment_id;
    const topupId = event.data.object.metadata?.topup_id;

    if (paymentId) {
      await admin
        .from("payments")
        .update({ status: "succeeded", provider_ref: event.data.object.id })
        .eq("id", paymentId);
    }

    // Agency wallet funding settles through the same webhook, told apart by
    // the metadata the top-up charge carried. settle_agency_topup is
    // idempotent, so a redelivered event never credits the wallet twice.
    if (topupId) {
      await admin.rpc("settle_agency_topup", {
        p_request_id: topupId,
        p_provider_ref: event.data.object.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
