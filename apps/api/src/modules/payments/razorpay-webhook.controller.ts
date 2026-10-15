import { Controller, Post, Req, Res, HttpStatus } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { getPaymentGateways } from "../../infra/payment-config";

/**
 * Razorpay webhook — settles card payments made through a payment link.
 * Authenticated by the X-Razorpay-Signature HMAC, not a user's Supabase JWT,
 * so it sits outside SupabaseAuthGuard like the Stripe webhook. The signing
 * secret is the one saved under Admin > Integrations > Payments.
 */
@Controller("payments/razorpay")
export class RazorpayWebhookController {
  constructor(private readonly admin: AdminSupabaseService) {}

  @Post("webhook")
  async handleWebhook(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    const secret = (await getPaymentGateways()).razorpay?.webhookSecret;
    if (!secret) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: "Webhook not configured" });
    }

    const payload = request.rawBody?.toString("utf8") ?? "";
    const signature = (request.headers["x-razorpay-signature"] as string) ?? "";
    const expectedBuf = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"));
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
      return response.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(payload) as {
      event: string;
      payload?: { payment_link?: { entity?: { id?: string; notes?: Record<string, string> } } };
    };

    if (event.event === "payment_link.paid") {
      const link = event.payload?.payment_link?.entity;
      const paymentId = link?.notes?.payment_id;
      if (paymentId) {
        await this.admin.get().from("payments").update({ status: "succeeded", provider_ref: link?.id }).eq("id", paymentId);
      }
    }

    return response.status(HttpStatus.OK).json({ received: true });
  }
}
