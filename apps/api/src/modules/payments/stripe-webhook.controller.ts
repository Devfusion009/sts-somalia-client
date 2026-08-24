import { Controller, Post, Req, Res, HttpStatus } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";

/**
 * Direct port of apps/web's app/api/payments/stripe/webhook/route.ts.
 * Authenticated by an external HMAC signature, not a user's Supabase JWT —
 * deliberately does NOT go through SupabaseAuthGuard/protectedProcedure,
 * unlike every other endpoint in this app. Exact same verification logic
 * (timing-safe comparison), not weakened or "simplified".
 *
 * OPERATIONAL NOTE FOR DEPLOYMENT: Stripe's dashboard webhook URL currently
 * points at apps/web's /api/payments/stripe/webhook. Once apps/api actually
 * deploys, that URL needs repointing at this endpoint
 * (/payments/stripe/webhook here) and STRIPE_WEBHOOK_SECRET needs to be set
 * on apps/api's environment (it's currently only in apps/web's). Not done
 * as part of this migration — a deploy-cutover task, tracked here so it
 * isn't forgotten.
 */
@Controller("payments/stripe")
export class StripeWebhookController {
  constructor(private readonly admin: AdminSupabaseService) {}

  @Post("webhook")
  async handleWebhook(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: "Webhook not configured" });
    }

    const payload = request.rawBody?.toString("utf8") ?? "";
    const signatureHeader = (request.headers["stripe-signature"] as string) ?? "";
    const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=") as [string, string]));
    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) {
      return response.status(HttpStatus.BAD_REQUEST).json({ error: "Missing signature" });
    }

    const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    const valid = expectedBuf.length === signatureBuf.length && timingSafeEqual(expectedBuf, signatureBuf);
    if (!valid) {
      return response.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(payload) as {
      type: string;
      data: { object: { id: string; metadata?: Record<string, string> } };
    };

    if (event.type === "checkout.session.completed") {
      const paymentId = event.data.object.metadata?.payment_id;
      if (paymentId) {
        await this.admin
          .get()
          .from("payments")
          .update({ status: "succeeded", provider_ref: event.data.object.id })
          .eq("id", paymentId);
      }
    }

    return response.status(HttpStatus.OK).json({ received: true });
  }
}
