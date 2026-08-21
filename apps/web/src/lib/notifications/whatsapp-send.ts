import "server-only";
import { getIntegrations } from "@/lib/integrations";

/**
 * Outbound WhatsApp send via Twilio's WhatsApp API — distinct from
 * src/lib/whatsapp.ts (click-to-chat wa.me links, which only ever open the
 * VIEWER's own WhatsApp client). This is the actual server-to-applicant
 * send path, e.g. "your application was approved."
 *
 * Deliberately built as a placeholder pending real credentials (per an
 * explicit client decision — Meta Business verification for the WhatsApp
 * number hasn't started yet): env-gated exactly like every other optional
 * integration in this codebase, so it's wired end-to-end and will start
 * working the moment TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
 * TWILIO_WHATSAPP_FROM are set — no code changes needed later.
 *
 * Twilio's WhatsApp API requires an approved message template outside a
 * 24h customer-initiated session window; `templateContentSid` is required
 * once you have one (see Twilio Content API). Until then this only works
 * for freeform replies within 24h of the applicant messaging first —
 * expect to add template support alongside real credentials.
 */
export type SendWhatsAppInput = {
  /** E.164 format, e.g. +2526XXXXXXXX */
  to: string;
  body: string;
  templateContentSid?: string;
};

export type SendWhatsAppResult = { sent: boolean; error?: string };

export async function sendWhatsAppMessage(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { whatsappApi } = getIntegrations();
  if (!whatsappApi) {
    return { sent: false, error: "WhatsApp send is not configured yet (Twilio credentials missing)." };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;

  try {
    const params = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${input.to}`,
      Body: input.body,
    });
    if (input.templateContentSid) {
      params.set("ContentSid", input.templateContentSid);
    }

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
