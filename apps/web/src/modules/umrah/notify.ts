import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToCustomer } from "@/lib/notifications/dispatch";
import { portalOrigin, rootOrigin } from "@/lib/subdomain";

/**
 * Email / WhatsApp for the Umrah moments a traveller has to act on or wants
 * to know now. The in-app notifications are written by SQL (stage changes,
 * cancellations, quotes, documents, reminders); this adds the out-of-app
 * channels, respecting the recipient's preferences. Same structure as
 * visa/notify.ts: the message carries the order reference and one line —
 * never passport data. Best-effort: a delivery failure never undoes the
 * action that caused it.
 *
 * For an agency booking the message goes to the agency's contact details,
 * because the booking's customer is the agent and the end pilgrim may have
 * no STS account.
 */
export type UmrahNotifyKind =
  | "stage_changed"
  | "document_rejected"
  | "balance_due"
  | "departure_reminder"
  | "booking_cancelled"
  | "flight_changed"
  | "request_quoted"
  | "request_declined";

const SUBJECTS: Record<UmrahNotifyKind, string> = {
  stage_changed: "Your Umrah booking was updated",
  document_rejected: "A document for your Umrah booking needs replacing",
  balance_due: "Umrah balance due",
  departure_reminder: "Your Umrah departure is coming up",
  booking_cancelled: "Your Umrah booking is cancelled",
  flight_changed: "Your Umrah travel details changed",
  request_quoted: "Your private Umrah price is ready",
  request_declined: "Your private Umrah request was declined",
};

const STAGE_LINES: Record<string, string> = {
  confirmed: "Your booking is confirmed.",
  visa_issued: "Visas are issued.",
  documents_ready: "Travel documents are ready to download.",
};

/** Stages worth a message outside the app; the rest stay in-app only. */
export const UMRAH_STAGES_TO_NOTIFY = new Set(Object.keys(STAGE_LINES));

const DEFAULT_LINES: Partial<Record<UmrahNotifyKind, string>> = {
  document_rejected: "A document you uploaded needs replacing.",
  booking_cancelled: "This booking is cancelled.",
  flight_changed: "Flight or travel dates changed.",
  request_quoted: "The price for your trip is ready to pay.",
  request_declined: "We could not arrange this trip.",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function notifyUmrahBooking(
  bookingId: string,
  kind: UmrahNotifyKind,
  line?: string,
  stage?: string
) {
  try {
    const stageKey = stage ?? "confirmed";
    if (kind === "stage_changed" && !UMRAH_STAGES_TO_NOTIFY.has(stageKey)) return;
    const text =
      line ??
      (kind === "stage_changed" ? STAGE_LINES[stageKey] : DEFAULT_LINES[kind]) ??
      "Your booking was updated.";

    const admin = createAdminClient();
    const { data: booking } = await admin
      .from("umrah_bookings")
      .select(
        "id, customer_id, agency_id, agency:agency_id(contact_email, contact_phone), order_items(order:order_id(id, order_number, created_at))"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const orders = (booking.order_items ?? [])
      .map((i) => (Array.isArray(i.order) ? i.order[0] : i.order))
      .filter((o): o is { id: string; order_number: string; created_at: string } => !!o)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const order = orders[0];
    if (!order) return;

    const agency = Array.isArray(booking.agency) ? booking.agency[0] : booking.agency;
    let email: string | null = agency?.contact_email ?? null;
    let phone: string | null = agency?.contact_phone ?? null;
    if (!booking.agency_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, phone")
        .eq("id", booking.customer_id)
        .maybeSingle();
      email = profile?.email ?? null;
      phone = profile?.phone ?? null;
    }

    const url = booking.agency_id
      ? `${portalOrigin("agent") || rootOrigin()}/agent/bookings/${order.id}`
      : `${rootOrigin()}/account/bookings/${order.id}`;
    const subject = `${SUBJECTS[kind]} — ${order.order_number}`;
    const body = `${order.order_number}: ${text}\n${url}`;
    const html = `<p><strong>${escapeHtml(order.order_number)}</strong></p><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url)}">Open your booking</a></p>`;

    await dispatchToCustomer({
      profileId: booking.customer_id,
      email,
      phone,
      content: { en: { subject, html, text: body } },
      critical: kind === "booking_cancelled",
    });
  } catch {
    // Out-of-app delivery is best-effort; the in-app notification already exists.
  }
}
