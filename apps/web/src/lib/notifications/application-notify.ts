import "server-only";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";
import { getIntegrations } from "@/lib/integrations";

export type ApplicationType = "agency" | "hotel_partner" | "affiliate" | "venue_partner";

const PORTAL_LABEL: Record<ApplicationType, string> = {
  agency: "Agent Portal",
  hotel_partner: "Hotel Partner Portal",
  affiliate: "Affiliate Dashboard",
  venue_partner: "Venue Portal",
};

const PORTAL_HREF: Record<ApplicationType, string> = {
  agency: "/agent",
  hotel_partner: "/partner",
  affiliate: "/affiliate",
  venue_partner: "/venue",
};

function emailShell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a2e29;">
      <h1 style="color: #00947c; font-size: 20px;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        STS Somalia &middot; Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho
      </p>
    </div>
  `;
}

function siteUrl(path: string): string {
  const { siteUrl } = getIntegrations();
  return `${siteUrl}${path}`;
}

/**
 * Best-effort notification on an application status change — sends email
 * and (if a phone number was captured) WhatsApp, but never throws: a
 * notification failure should never block the actual status change from
 * saving. Callers should still surface `emailSent`/`whatsappSent` in the
 * admin UI so staff know if a message genuinely went out.
 */
export async function notifyApplicant(params: {
  type: ApplicationType;
  applicantEmail: string;
  applicantPhone?: string | null;
  referenceNumber: string;
  event: "approved" | "rejected" | "more_info_requested" | "submitted";
  message?: string | null;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const { subject, html, whatsapp } = buildContent(params);

  const emailResult = await sendEmail({ to: params.applicantEmail, subject, html });

  let whatsappSent = false;
  if (params.applicantPhone) {
    const waResult = await sendWhatsAppMessage({ to: params.applicantPhone, body: whatsapp });
    whatsappSent = waResult.sent;
  }

  return { emailSent: emailResult.sent, whatsappSent };
}

function buildContent(params: {
  type: ApplicationType;
  referenceNumber: string;
  event: "approved" | "rejected" | "more_info_requested" | "submitted";
  message?: string | null;
}): { subject: string; html: string; whatsapp: string } {
  const label = PORTAL_LABEL[params.type];
  const href = siteUrl(PORTAL_HREF[params.type]);
  const becomeHref = siteUrl("/account/become");

  switch (params.event) {
    case "submitted":
      return {
        subject: `Application received — ${params.referenceNumber}`,
        html: emailShell(
          "We've got your application",
          `<p>Thanks for applying. Your reference number is <strong>${params.referenceNumber}</strong> — our team will review it and get back to you.</p>`
        ),
        whatsapp: `STS Somalia: Your application ${params.referenceNumber} has been received and is under review.`,
      };
    case "approved":
      return {
        subject: `You're approved — welcome to STS Somalia`,
        html: emailShell(
          "You're approved!",
          `<p>Your application (${params.referenceNumber}) has been approved. Log in with your existing STS account to open your ${label}.</p>
           <p><a href="${href}" style="background:#00947c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Open ${label}</a></p>`
        ),
        whatsapp: `STS Somalia: Great news — your application ${params.referenceNumber} has been approved. Log in to open your ${label}: ${href}`,
      };
    case "rejected":
      return {
        subject: `Update on your application — ${params.referenceNumber}`,
        html: emailShell(
          "Application not approved",
          `<p>Your application (${params.referenceNumber}) wasn't approved this time.</p>
           ${params.message ? `<p><strong>Reason:</strong> ${params.message}</p>` : ""}
           <p>You're welcome to reapply after 30 days.</p>`
        ),
        whatsapp: `STS Somalia: Your application ${params.referenceNumber} wasn't approved.${params.message ? ` Reason: ${params.message}` : ""} You can reapply after 30 days.`,
      };
    case "more_info_requested":
      return {
        subject: `Action needed on your application — ${params.referenceNumber}`,
        html: emailShell(
          "We need a bit more information",
          `<p>To keep reviewing your application (${params.referenceNumber}), we need some more details:</p>
           ${params.message ? `<p style="background:#fef3c7;padding:12px;border-radius:8px;">${params.message}</p>` : ""}
           <p><a href="${becomeHref}" style="background:#00947c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Update your application</a></p>`
        ),
        whatsapp: `STS Somalia: We need more info on application ${params.referenceNumber}.${params.message ? ` ${params.message}` : ""} Update it here: ${becomeHref}`,
      };
  }
}
