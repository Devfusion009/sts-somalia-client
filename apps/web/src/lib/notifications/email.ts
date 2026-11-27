import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getIntegrations } from "@/lib/integrations";
import { getSocialLinks } from "@/lib/site-settings";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { SOCIAL_SLOT, socialBadge, wrapEmailHtml } from "./email-layout";

/**
 * Transactional email, one entry point for the whole app.
 *
 * Configuration (see apps/web/.env.example, "Email"):
 *   EMAIL_PROVIDER   "smtp" or "resend"; empty means no provider is connected.
 *   EMAIL_FROM       Sender, e.g. "STS Somalia <no-reply@scoutsts.com>".
 *   EMAIL_REPLY_TO   Where replies go, e.g. "support@scoutsts.com".
 *   SMTP_HOST/PORT/SECURE/USER/PASS  Mailbox login for the "smtp" provider.
 *   RESEND_API_KEY   Credential for the "resend" provider.
 *
 * Every caller builds and hands over the full message regardless of
 * configuration. With no provider connected the message is not sent: the
 * result says `status: "not_configured"` and one log line records the
 * recipient and subject, so the email the app would have sent is traceable.
 * Sending never throws; a failed email must not undo the action that
 * triggered it.
 *
 * Resend is a plain fetch against its REST API. SMTP (e.g. a Hostinger
 * mailbox) goes through nodemailer, since SMTP has no HTTP equivalent.
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

let smtpTransport: Transporter | null = null;

function smtp(): Transporter {
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT || 465);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
  }
  return smtpTransport;
}

/**
 * Every message leaves in the branded frame: bare HTML fragments are wrapped,
 * and the footer's social slot gets the links an admin set in Site settings.
 */
async function finishHtml(subject: string, html: string): Promise<string> {
  const framed = wrapEmailHtml(subject, html);
  if (!framed.includes(SOCIAL_SLOT)) return framed;
  const links = await getSocialLinks().catch(() => []);
  const badges = links
    .map((link) => socialBadge({ label: SOCIAL_PLATFORMS[link.platform].label, icon: link.platform, href: link.url }))
    .join("");
  return framed.replace(SOCIAL_SLOT, badges);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { email } = getIntegrations();
  const to = asList(input.to);
  const replyTo = input.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined;

  if (email.provider === "smtp" || email.provider === "resend") {
    input = { ...input, html: await finishHtml(input.subject, input.html) };
  }

  if (email.provider === "smtp") {
    try {
      await smtp().sendMail({
        from: fromAddress(),
        to,
        cc: input.cc?.length ? input.cc : undefined,
        replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { sent: true, status: "sent" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed.";
      console.error(`[email] smtp send failed · subject="${input.subject}" · ${message}`);
      return { sent: false, status: "failed", error: message };
    }
  }

  if (email.provider !== "resend") {
    console.info(`[email] not sent, no provider configured · to=${to.join(",")} · subject="${input.subject}"`);
    return { sent: false, status: "not_configured", error: "No email provider is configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
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
