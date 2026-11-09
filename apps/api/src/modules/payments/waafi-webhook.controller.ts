import { Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request, Response } from "express";
import { verifyWaafiSignature } from "@sts/shared-types/dist/waafi-server";
import { getWaafiForSettlement } from "../../infra/payment-config";
import { WaafiService, type WaafiWebhook } from "./waafi.service";

@Controller("payments/waafi")
export class WaafiWebhookController {
  constructor(private readonly waafi: WaafiService) {}

  @Post("webhook")
  async handleWebhook(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    // Provider registration pings are unsigned and never alter financial data.
    if (request.body?.event === "webhook.test") return response.status(HttpStatus.OK).json({ received: true });
    const gateway = await getWaafiForSettlement();
    if (!gateway?.webhookSecret) return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: "Webhook not configured" });
    const eventId = request.get("x-webhook-event-id");
    if (!request.rawBody || !verifyWaafiSignature(request.rawBody, {
      timestamp: request.get("x-webhook-timestamp"), eventId,
      signature: request.get("x-webhook-signature"), algorithm: request.get("x-webhook-signature-alg"),
    }, gateway.webhookSecret)) return response.status(HttpStatus.UNAUTHORIZED).json({ error: "Invalid signature" });
    try {
      const event = JSON.parse(request.rawBody.toString("utf8")) as WaafiWebhook;
      await this.waafi.processWebhook(event, eventId!, gateway);
      return response.status(HttpStatus.OK).json({ received: true });
    } catch {
      // A transient database error is retriable; never acknowledge an unrecorded payment.
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: "Payment confirmation pending" });
    }
  }
}
