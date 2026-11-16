import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrations } from "@/lib/integrations";
import { portalOrigin, rootOrigin, type PortalSubdomain } from "@/lib/subdomain";
import { sendEmail } from "./email";
import { escapeHtml, renderEmail, renderEmailText, type EmailTone } from "./email-layout";
import { adminNotificationHref, agentNotificationHref, customerNotificationHref, type NotificationLike } from "./links";

/**
 * Notification email outbox.
 *
 * Every row in `notifications` (the portal bell) is also an email job. This
 * worker claims pending rows (claim_notification_emails, SKIP LOCKED), turns
 * each into one branded email to the recipient and records the result.
 *
 * - Types that already have a dedicated email (application decisions, visa,
 *   Umrah, flight bookings, partner bookings) are skipped, so nobody gets the
 *   same news twice.
 * - Customers who switched email off in their preferences are skipped,
 *   except for money and account events, which always send.
 * - Agent and manager logins use synthetic addresses; their real contact
 *   address is looked up instead.
 * - With no email provider connected nothing is claimed, so the queue waits.
 */

const SENT_ELSEWHERE = new Set([
  "application_submitted_confirmation",
  "application_approved",
  "application_rejected",
  "application_more_info_requested",
  "visa_status_changed",
  "flight_booked",
  "flight_ticketed",
  "partner_onboarding_reminder",
  "new_booking",
]);
const SENT_ELSEWHERE_PREFIXES = ["umrah_"];

/** Sent even when the recipient turned email notifications off. */
const ALWAYS_SEND = new Set([
  "visa_documents_reminder",
  "visa_auto_cancelled",
  "visa_refusal_credit",
  "flight_booking_delayed",
  "order_paid",
  "wallet_booking_payment",
  "topup_reviewed",
  "payout_request_reviewed",
  "payout_sent",
  "payout_paid",
  "payout_failed",
  "earnings_reviewed",
  "low_balance",
  "application_document_rejected",
]);

const WARNING_TYPES = new Set(["visa_documents_reminder", "visa_auto_cancelled", "flight_ticketing_failed", "low_balance", "payout_failed", "application_document_rejected", "booking_declined", "waafi_payment_review", "visa_case_attention"]);
const SUCCESS_TYPES = new Set(["order_paid", "booking_confirmed", "payout_paid", "payout_sent", "application_documents_verified", "booking_request_completed"]);

/** Status pill text per event; anything unlisted reads as a plain update. */
const LABELS: Record<string, string> = {
  order_paid: "Payment received",
  booking_confirmed: "Booking confirmed",
  booking_declined: "Booking update",
  booking_waitlisted: "Waitlist",
  booking_request_completed: "Request completed",
  booking_rescheduled: "Booking rescheduled",
  wallet_booking_payment: "Wallet payment",
  topup_reviewed: "Wallet top-up",
  topup_request: "Top-up request",
  low_balance: "Low balance",
  payout_request: "Withdrawal request",
  payout_request_reviewed: "Withdrawal",
  payout_sent: "Transfer sent",
  payout_paid: "Withdrawal paid",
  payout_failed: "Withdrawal failed",
  earnings_reviewed: "Earnings",
  markup_request: "Markup request",
  markup_request_reviewed: "Markup",
  new_order: "New order",
  application_submitted: "New application",
  application_updated: "Application update",
  application_document_resubmitted: "Document resubmitted",
  application_document_rejected: "Action needed",
  application_documents_verified: "Documents verified",
  visa_application_submitted: "New visa application",
  visa_case_attention: "Needs attention",
  flight_ticketing_failed: "Flight booking failed",
  flight_booking_delayed: "Ticket in progress",
  visa_documents_reminder: "Documents needed",
  visa_auto_cancelled: "Application cancelled",
  visa_refusal_credit: "Re-application credit",
  private_umrah_request: "Umrah booking request",
  waafi_payment_review: "Payment review",
  admin_event_reminder: "Reminder",
};

type Audience = { portal: PortalSubdomain | null; label: string; href: (n: NotificationLike) => string | null; home: string };

const CUSTOMER: Audience = { portal: null, label: "Your STS account", href: customerNotificationHref, home: "/account" };

function audienceFor(role: string, isPlatformAdmin: boolean): Audience {
  if (isPlatformAdmin || role === "admin") return { portal: "admin", label: "STS Admin", href: adminNotificationHref, home: "/admin" };
  if (role === "agent") return { portal: "agent", label: "Agent Portal", href: agentNotificationHref, home: "/agent" };
  if (role === "hotel_partner") return { portal: "partner", label: "Partner Portal", href: () => null, home: "/partner" };
  if (role === "venue_partner") return { portal: "venue", label: "Venue Portal", href: () => null, home: "/venue" };
  if (role === "hotel_manager" || role === "venue_manager") return { portal: "manager", label: "Manager Portal", href: () => null, home: "/manager" };
  if (role === "affiliate") return { portal: "affiliate", label: "Affiliate Portal", href: () => null, home: "/affiliate" };
  return CUSTOMER;
}

function absolute(audience: Audience, path: string): string {
  const origin = (audience.portal ? portalOrigin(audience.portal) : "") || rootOrigin() || getIntegrations().siteUrl;
  return `${origin.replace(/\/$/, "")}${path}`;
}

type Recipient = { email: string; firstName: string | null; audience: Audience; emailEnabled: boolean };

async function recipientFor(profileId: string): Promise<Recipient | null> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("email, full_name, role, is_platform_admin, manager_contact_email").eq("id", profileId).maybeSingle(),
    admin.from("notification_preferences").select("email_enabled").eq("profile_id", profileId).maybeSingle(),
  ]);
  if (!profile) return null;

  let email = profile.email ?? null;
  if (email?.endsWith("@agent-login.scoutsts.invalid")) {
    const { data } = await admin.from("agent_login_credentials").select("contact_email").eq("login_email", email).maybeSingle();
    email = data?.contact_email ?? null;
  } else if (email?.endsWith("@manager-login.scoutsts.invalid")) {
    email = profile.manager_contact_email ?? null;
  }
  if (!email || email.endsWith(".invalid")) return null;

  return {
    email,
    firstName: profile.full_name?.trim().split(/\s+/)[0] ?? null,
    audience: audienceFor(profile.role, profile.is_platform_admin),
    emailEnabled: prefs?.email_enabled ?? true,
  };
}

type Row = { id: string; profile_id: string; type: string; title: string; body: string | null; data: unknown };

function detailsFor(row: Row): Array<{ label: string; value: string; mono?: boolean }> {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const rows: Array<{ label: string; value: string; mono?: boolean }> = [];
  const reference = data.order_number ?? data.orderNumber ?? data.reference ?? data.applicationRef;
  if (typeof reference === "string" && reference) rows.push({ label: "Reference", value: reference, mono: true });
  const amount = data.total ?? data.amount;
  const currency = typeof data.currency === "string" ? data.currency : "USD";
  if ((typeof amount === "number" || typeof amount === "string") && Number.isFinite(Number(amount))) {
    rows.push({ label: "Amount", value: `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
  }
  return rows;
}

/** One notification as a finished email. Exported for previews and tests. */
export function renderNotificationEmail(row: Row, recipient: Pick<Recipient, "firstName" | "audience">) {
  const tone: EmailTone = WARNING_TYPES.has(row.type) ? "warning" : SUCCESS_TYPES.has(row.type) ? "success" : "neutral";
  const path = recipient.audience.href(row) ?? recipient.audience.home;
  const button = { label: "Open in STS", href: absolute(recipient.audience, path) };
  const greeting = recipient.firstName ? `Hello ${recipient.firstName},` : "Hello,";
  const body = row.body?.trim() || row.title;
  const content = {
    preheader: body,
    label: LABELS[row.type] ?? "Update",
    tone,
    heading: row.title,
    paragraphs: [escapeHtml(greeting), escapeHtml(body)],
    details: detailsFor(row),
    button,
    audience: recipient.audience.label,
  };
  return {
    subject: row.title,
    html: renderEmail(content),
    text: renderEmailText({ ...content, textParagraphs: [greeting, body] }),
  };
}

function sentElsewhere(type: string): boolean {
  return SENT_ELSEWHERE.has(type) || SENT_ELSEWHERE_PREFIXES.some((prefix) => type.startsWith(prefix));
}

export type OutboxRun = { claimed: number; sent: number; skipped: number; failed: number };

/** Claims and sends one batch. Safe to call concurrently and repeatedly. */
export async function processNotificationEmails(limit = 25): Promise<OutboxRun> {
  const run: OutboxRun = { claimed: 0, sent: 0, skipped: 0, failed: 0 };
  if (!getIntegrations().email.provider) return run;

  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("claim_notification_emails", { p_limit: limit });
  if (error || !rows?.length) return run;
  run.claimed = rows.length;

  const recipients = new Map<string, Promise<Recipient | null>>();
  for (const row of rows) {
    const finish = (status: "sent" | "skipped" | "failed" | "pending") =>
      admin
        .from("notifications")
        .update({ email_status: status, emailed_at: status === "sent" ? new Date().toISOString() : null })
        .eq("id", row.id);

    if (sentElsewhere(row.type)) {
      await finish("skipped");
      run.skipped++;
      continue;
    }

    if (!recipients.has(row.profile_id)) recipients.set(row.profile_id, recipientFor(row.profile_id));
    const recipient = await recipients.get(row.profile_id)!;
    if (!recipient || (!recipient.emailEnabled && !ALWAYS_SEND.has(row.type))) {
      await finish("skipped");
      run.skipped++;
      continue;
    }

    const message = renderNotificationEmail(row, recipient);
    const result = await sendEmail({ to: recipient.email, ...message });
    if (result.sent) {
      await finish("sent");
      run.sent++;
    } else {
      // Back in the queue until the third attempt; the claim counts attempts.
      await finish(row.email_attempts >= 3 ? "failed" : "pending");
      run.failed++;
    }
  }
  return run;
}
