import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { SifaloService } from "./sifalo.service";

/**
 * Sifalo Pay payment callback. The payload is unauthenticated (Sifalo
 * documents no signature), so it only names which payment to look at —
 * SifaloService re-verifies the sid with Sifalo before settling anything.
 * Sits outside SupabaseAuthGuard like the other gateway webhooks.
 */
@Controller("payments/sifalo")
export class SifaloWebhookController {
  constructor(private readonly sifalo: SifaloService) {}

  @Post("webhook")
  async handleWebhook(@Body() body: { sid?: string; order_id?: string }, @Res() response: Response) {
    if (body?.sid && body?.order_id) {
      await this.sifalo.settle(String(body.order_id), String(body.sid));
    }
    return response.status(HttpStatus.OK).json({ received: true });
  }
}
