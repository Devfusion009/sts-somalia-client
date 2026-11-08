import "server-only";
import { getIntegrations } from "@/lib/integrations";

/**
 * Transactional email, one entry point for the whole app.
 *
 * Configuration (see apps/web/.env.example, "Email"):
 *   EMAIL_PROVIDER   "resend" today; empty means no provider is connected.
 *   EMAIL_FROM       Sender, e.g. "STS Somalia <no-reply@scoutsts.com>".
 *   EMAIL_REPLY_TO   Where replies go, e.g. "info@scoutsts.com".
 *   RESEND_API_KEY   Credential for the "resend" provider.
 *
 * Every caller builds and hands over the full message regardless of
 * configuration. With no provider connected the message is not sent: the
 * result says `status: "not_configured"` and one log line records the
 * recipient and subject, so the email the app would have sent is traceable.
 * Sending never throws; a failed email must not undo the action that
 * triggered it.
 *
 * Plain fetch against the provider's REST API, no SDK — the codebase's
 * convention for third-party providers.
 */
export type SendEmailInput = {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  /** Plain-text alternative for clients that do not render HTML. */
  text?: string;
  replyTo?: string;
};

export type EmailStatus = "sent" | "not_configured" | "failed";

export type SendEmailResult = { sent: boolean; status: EmailStatus; error?: string };

const DEFAULT_FROM = "Scout Travel Solution <no-reply@scoutsts.com>";

function fromAddress(): string {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
}

function asList(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { email } = getIntegrations();
  const to = asList(input.to);
  const replyTo = input.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined;

  if (email.provider !== "resend") {
    console.info(`[email] not sent, no provider configured · to=${to.join(",")} · subject="${input.subject}"`);
    return { sent: false, status: "not_configured", error: "No email provider is configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to,
        cc: input.cc?.length ? input.cc : undefined,
        reply_to: replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] provider rejected · status=${res.status} · subject="${input.subject}"`);
      return { sent: false, status: "failed", error: `Resend returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true, status: "sent" };
  } catch {
    console.error(`[email] provider unreachable · subject="${input.subject}"`);
    return { sent: false, status: "failed", error: "Could not reach the email provider." };
  }
}
