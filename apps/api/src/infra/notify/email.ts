import { getIntegrations } from "../integrations";

/** Direct port of apps/web's lib/notifications/email.ts. Plain fetch against Resend, no SDK. */
export type SendEmailInput = { to: string; subject: string; html: string };
export type SendEmailResult = { sent: boolean; error?: string };

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "STS Somalia <notifications@sts-somalia.example>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { email } = getIntegrations();
  if (!email.resend) {
    return { sent: false, error: "Resend is not configured (RESEND_API_KEY missing)." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [input.to], subject: input.subject, html: input.html }),
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
