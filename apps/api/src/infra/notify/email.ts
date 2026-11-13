import nodemailer, { type Transporter } from "nodemailer";
import { getIntegrations } from "../integrations";
import { env } from "../../config/env";
import { SOCIAL_SLOT, wrapEmailHtml } from "./email-layout";

/** Port of apps/web's lib/notifications/email.ts: SMTP via nodemailer, or Resend via plain fetch. */
export type SendEmailInput = { to: string; subject: string; html: string };
export type SendEmailResult = { sent: boolean; error?: string };

let smtpTransport: Transporter | null = null;

function smtp(): Transporter {
  if (!smtpTransport) {
    const port = Number(env().SMTP_PORT || 465);
    smtpTransport = nodemailer.createTransport({
      host: env().SMTP_HOST,
      port,
      secure: env().SMTP_SECURE ? env().SMTP_SECURE === "true" : port === 465,
      auth: { user: env().SMTP_USER, pass: env().SMTP_PASS },
      pool: true,
      maxConnections: 3,
    });
  }
  return smtpTransport;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { email } = getIntegrations();
  const from = env().EMAIL_FROM || env().RESEND_FROM_EMAIL || "Scout Travel Solution <no-reply@scoutsts.com>";
  const replyTo = env().EMAIL_REPLY_TO || undefined;
  // Same branded frame as the web app; the API has no Site settings cache, so
  // the footer keeps its WhatsApp and website badges only.
  input = { ...input, html: wrapEmailHtml(input.subject, input.html).replace(SOCIAL_SLOT, "") };

  if (email.provider === "smtp") {
    try {
      await smtp().sendMail({ from, to: input.to, replyTo, subject: input.subject, html: input.html });
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed.";
      console.error(`[email] smtp send failed · subject="${input.subject}" · ${message}`);
      return { sent: false, error: message };
    }
  }

  if (!email.resend) {
    console.info(`[email] not sent, no provider configured · to=${input.to} · subject="${input.subject}"`);
    return { sent: false, error: "No email provider is configured." };
  }

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
        reply_to: replyTo,
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
