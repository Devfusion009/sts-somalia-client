import "server-only";
import { format } from "date-fns";
import { sendEmail, type EmailStatus } from "./email";
import { renderEmail, renderEmailText, escapeHtml, type EmailContent } from "./email-layout";
import { sendWhatsAppMessage } from "./whatsapp-send";
import { getIntegrations } from "@/lib/integrations";
import { portalHref, portalLoginHref, type PortalSubdomain } from "@/lib/subdomain";

export type ApplicationType = "agency" | "hotel_partner" | "affiliate" | "venue_partner";
export type ApplicationEvent = "approved" | "rejected" | "more_info_requested" | "submitted";

/** Agent Portal sign-in details issued on an agency approval. */
export type AgentLogin = { agentId: string; password: string };

const PROGRAM: Record<ApplicationType, string> = {
  agency: "Travel Agent",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
  venue_partner: "Venue Partner",
};

const PORTAL: Record<ApplicationType, { label: string; subdomain: PortalSubdomain }> = {
  agency: { label: "Agent Portal", subdomain: "agent" },
  hotel_partner: { label: "Hotel Partner Portal", subdomain: "partner" },
  affiliate: { label: "Affiliate Dashboard", subdomain: "affiliate" },
  venue_partner: { label: "Venue Portal", subdomain: "venue" },
};

/** What a newly approved partner does first, in the order the portal leads them through it. */
const FIRST_STEPS: Record<ApplicationType, string[]> = {
  agency: [
    "Sign in to the Agent Portal with the agent ID and password in this email.",
    "Change your password under Security.",
    "Complete your agency profile and bank details.",
    "Top up your wallet, then start booking flights, hotels, visas and Umrah for your customers.",
  ],
  hotel_partner: [
    "Sign in to the Hotel Partner Portal with your STS account.",
    "Add your rooms, rates, availability and photos.",
    "Publish your property so travellers and agents can book it.",
  ],
  affiliate: [
    "Sign in to the Affiliate Dashboard with your STS account.",
    "Copy your referral link and share it with your audience.",
    "Track referred bookings and commission from the dashboard.",
  ],
  venue_partner: [
    "Sign in to the Venue Portal with your STS account.",
    "Add your halls with capacity, pricing and photos.",
    "Publish them so customers can book events.",
  ],
};

function absolute(href: string): string {
  return /^https?:\/\//.test(href) ? href : `${getIntegrations().siteUrl}${href}`;
}

/**
 * Who an application email goes to.
 *
 * The primary recipient is the email the applicant entered on the
 * application itself (the authorized contact's, or the affiliate's own), since
 * that is the address they chose for this business relationship. The address
 * of the STS account that submitted it is copied when it differs, so the
 * account holder always learns the outcome too. Without an application email,
 * the account email is the only recipient.
 */
export function applicationRecipients(applicationEmail: string | null | undefined, accountEmail: string): {
  to: string;
  cc: string[];
} {
  const chosen = applicationEmail?.trim();
  const valid = chosen && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chosen) ? chosen : null;
  if (!valid || valid.toLowerCase() === accountEmail.toLowerCase()) return { to: accountEmail, cc: [] };
  return { to: valid, cc: [accountEmail] };
}

export type ApplicationNotice = {
  type: ApplicationType;
  event: ApplicationEvent;
  referenceNumber: string;
  /** Business, property or applicant name the application was filed under. */
  applicantName: string | null;
  /** Person the email greets: the authorized contact, else the account holder. */
  recipientName: string | null;
  to: string;
  cc?: string[];
  phone?: string | null;
  /** Rejection reason or the list of requested changes. */
  message?: string | null;
  agentLogin?: AgentLogin | null;
  decidedAt?: Date;
};

export type ApplicantNotifyResult = {
  /** "sent", "not_configured" (no email provider yet) or "failed". */
  email: EmailStatus;
  emailTo: string;
  emailSent: boolean;
  whatsappSent: boolean;
};

/**
 * Tells the applicant about a status change by email (and WhatsApp when a
 * number is known). Best effort and never throws: the status change has
 * already been saved, and a delivery problem must not undo it. The caller
 * reports `email` back to the admin so staff know whether a message went out.
 */
export async function notifyApplicant(notice: ApplicationNotice): Promise<ApplicantNotifyResult> {
  const { subject, html, text, whatsapp } = renderApplicationEmail(notice);

  const emailResult = await sendEmail({ to: notice.to, cc: notice.agentLogin ? undefined : notice.cc, subject, html, text });

  let whatsappSent = false;
  if (notice.phone) {
    const waResult = await sendWhatsAppMessage({ to: notice.phone, body: whatsapp });
    whatsappSent = waResult.sent;
  }

  return { email: emailResult.status, emailTo: notice.to, emailSent: emailResult.sent, whatsappSent };
}

/** The finished message for one notice: subject, HTML and plain text, plus the WhatsApp line. */
export function renderApplicationEmail(notice: ApplicationNotice): {
  subject: string;
  html: string;
  text: string;
  whatsapp: string;
} {
  const { content, textParagraphs, subject, whatsapp } = buildContent(notice);
  return { subject, html: renderEmail(content), text: renderEmailText({ ...content, textParagraphs }), whatsapp };
}

function greeting(name: string | null): string {
  return name?.trim() ? `Dear ${name.trim()},` : "Dear Partner,";
}

function buildContent(n: ApplicationNotice): {
  content: EmailContent;
  textParagraphs: string[];
  subject: string;
  whatsapp: string;
} {
  const program = PROGRAM[n.type];
  const portal = PORTAL[n.type];
  const name = n.applicantName?.trim() || null;
  const nameHtml = name ? `<strong>${escapeHtml(name)}</strong>` : "your business";
  const ref = n.referenceNumber;
  const date = format(n.decidedAt ?? new Date(), "d MMMM yyyy");
  const baseDetails = [
    { label: "Reference", value: ref, mono: true },
    { label: "Program", value: program },
    ...(name ? [{ label: n.type === "affiliate" ? "Applicant" : "Business", value: name }] : []),
  ];

  switch (n.event) {
    case "approved": {
      const loginHref = absolute(n.agentLogin ? portalLoginHref(portal.subdomain) : portalHref(portal.subdomain));
      const lead = `We have reviewed and approved the ${program} application for ${name ?? "your business"}. Your ${portal.label} is ready to use.`;
      return {
        subject: `Approved: your STS ${program} application (${ref})`,
        whatsapp: n.agentLogin
          ? `STS Somalia: Your ${program} application ${ref} is approved. Your agent ID and password have been sent by email. Sign in: ${loginHref}`
          : `STS Somalia: Your ${program} application ${ref} is approved. Open your ${portal.label}: ${loginHref}`,
        textParagraphs: [greeting(n.recipientName), lead],
        content: {
          preheader: `Your ${program} application ${ref} is approved. Your ${portal.label} is ready.`,
          label: "Application approved",
          tone: "success",
          heading: `Welcome to STS Somalia as a ${program} partner`,
          paragraphs: [
            escapeHtml(greeting(n.recipientName)),
            `We have reviewed and approved the ${program} application for ${nameHtml}. Your ${escapeHtml(portal.label)} is ready to use.`,
          ],
          details: [
            ...baseDetails,
            { label: "Approved on", value: date },
            ...(n.agentLogin
              ? [
                  { label: "Agent ID", value: n.agentLogin.agentId, mono: true },
                  { label: "Password", value: n.agentLogin.password, mono: true },
                ]
              : []),
          ],
          steps: { title: "Your next steps", items: FIRST_STEPS[n.type] },
          button: { label: `Open the ${portal.label}`, href: loginHref },
        },
      };
    }

    case "rejected": {
      const reapply = absolute("/account/become");
      const lead = `Thank you for applying to the STS ${program} program. After reviewing the application for ${name ?? "your business"}, we are unable to approve it at this time.`;
      const after = "You may submit a new application 30 days after this decision.";
      return {
        subject: `Update on your STS ${program} application (${ref})`,
        whatsapp: `STS Somalia: Your ${program} application ${ref} was not approved.${n.message ? ` Reason: ${n.message}` : ""} You may reapply after 30 days.`,
        textParagraphs: [greeting(n.recipientName), lead, after],
        content: {
          preheader: `A decision on your ${program} application ${ref}.`,
          label: "Application not approved",
          tone: "neutral",
          heading: `Your ${program} application was not approved`,
          paragraphs: [
            escapeHtml(greeting(n.recipientName)),
            `Thank you for applying to the STS ${program} program. After reviewing the application for ${nameHtml}, we are unable to approve it at this time.`,
            escapeHtml(after),
          ],
          details: [...baseDetails, { label: "Decision date", value: date }],
          note: n.message ? { title: "Reason", body: n.message } : undefined,
          button: { label: "View your applications", href: reapply },
        },
      };
    }

    case "more_info_requested": {
      const update = absolute("/account/become");
      const lead = `Our team is reviewing the ${program} application for ${name ?? "your business"} and needs the following before it can continue.`;
      return {
        subject: `Action needed on your STS ${program} application (${ref})`,
        whatsapp: `STS Somalia: We need more information on your ${program} application ${ref}.${n.message ? ` ${n.message}` : ""} Update it here: ${update}`,
        textParagraphs: [greeting(n.recipientName), lead],
        content: {
          preheader: `Your ${program} application ${ref} needs an update before review continues.`,
          label: "Action needed",
          tone: "warning",
          heading: "We need a few more details",
          paragraphs: [
            escapeHtml(greeting(n.recipientName)),
            `Our team is reviewing the ${program} application for ${nameHtml} and needs the following before it can continue.`,
          ],
          details: baseDetails,
          note: n.message ? { title: "Requested by our review team", body: n.message } : undefined,
          button: { label: "Update your application", href: update },
        },
      };
    }

    case "submitted": {
      const track = absolute("/account/become");
      const lead = `We have received the ${program} application for ${name ?? "your business"}. Our team will review it and email you with the outcome.`;
      return {
        subject: `Application received: STS ${program} (${ref})`,
        whatsapp: `STS Somalia: Your ${program} application ${ref} has been received and is under review.`,
        textParagraphs: [greeting(n.recipientName), lead],
        content: {
          preheader: `Your ${program} application ${ref} has been received.`,
          label: "Application received",
          tone: "neutral",
          heading: "Your application is with our team",
          paragraphs: [
            escapeHtml(greeting(n.recipientName)),
            `We have received the ${program} application for ${nameHtml}. Our team will review it and email you with the outcome.`,
          ],
          details: baseDetails,
          button: { label: "Track your application", href: track },
        },
      };
    }
  }
}
