import "server-only";
import { getIntegrations } from "@/lib/integrations";

/**
 * Plain fetch against Resend's REST API — no SDK, matching this codebase's
 * existing convention for third-party providers (see flights/provider.ts,
 * payments/providers.ts: "No SDK — plain fetch, mapped to a small shape the
 * UI owns"). Silently no-ops when RESEND_API_KEY isn't set, same fallback
 * shape as every other optional integration here — callers don't need to
 * check getIntegrations() themselves before calling this.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

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
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [input.to],
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
