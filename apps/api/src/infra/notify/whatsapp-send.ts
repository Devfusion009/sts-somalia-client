import { getIntegrations } from "../integrations";
import { env } from "../../config/env";

/**
 * Direct port of apps/web's lib/notifications/whatsapp-send.ts — outbound
 * WhatsApp via Twilio. Placeholder pending real credentials (Meta Business
 * verification not started as of this port) — env-gated, degrades to a
 * no-op result rather than throwing. Unchanged from the original.
 */
export type SendWhatsAppInput = { to: string; body: string; templateContentSid?: string };
export type SendWhatsAppResult = { sent: boolean; error?: string };

export async function sendWhatsAppMessage(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { whatsappApi } = getIntegrations();
  if (!whatsappApi) {
    return { sent: false, error: "WhatsApp send is not configured yet (Twilio credentials missing)." };
  }

  const accountSid = env().TWILIO_ACCOUNT_SID!;
  const authToken = env().TWILIO_AUTH_TOKEN!;
  const from = env().TWILIO_WHATSAPP_FROM!;

  try {
    const params = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${input.to}`,
      Body: input.body,
    });
    if (input.templateContentSid) params.set("ContentSid", input.templateContentSid);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Twilio returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, error: "Could not reach the WhatsApp provider." };
  }
}
