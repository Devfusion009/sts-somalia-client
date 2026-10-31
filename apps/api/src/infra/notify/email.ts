import { getIntegrations } from "../integrations";
import { env } from "../../config/env";

/** Direct port of apps/web's lib/notifications/email.ts. Plain fetch against Resend, no SDK. */
export type SendEmailInput = { to: string; subject: string; html: string };
export type SendEmailResult = { sent: boolean; error?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { email } = getIntegrations();
  if (!email.resend) {
    console.info(`[email] not sent, no provider configured · to=${input.to} · subject="${input.subject}"`);
    return { sent: false, error: "No email provider is configured." };
  }
  const from = env().EMAIL_FROM || env().RESEND_FROM_EMAIL || "STS Somalia <notifications@sts-somalia.example>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: env().EMAIL_REPLY_TO || undefined,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Resend returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, error: "Could not reach the email provider." };
  }
}
