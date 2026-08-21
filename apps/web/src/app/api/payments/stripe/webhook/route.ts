import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — settles card payments. Configure the endpoint in the
 * Stripe dashboard pointing at /api/payments/stripe/webhook and set
 * STRIPE_WEBHOOK_SECRET; without the secret the route refuses to process
 * events rather than trusting unverified input.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
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
    const paymentId = event.data.object.metadata?.payment_id;
    if (paymentId) {
      const admin = createAdminClient();
      await admin
        .from("payments")
        .update({ status: "succeeded", provider_ref: event.data.object.id })
        .eq("id", paymentId);
    }
  }

  return NextResponse.json({ received: true });
}
