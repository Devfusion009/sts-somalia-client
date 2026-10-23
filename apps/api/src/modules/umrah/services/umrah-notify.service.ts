import { Injectable } from "@nestjs/common";
import { env } from "../../../config/env";
import { dispatchToCustomer } from "../../../infra/notify/dispatch";
import { createAdminClient } from "../../../infra/supabase/supabase-clients";

/**
 * Email / WhatsApp for the Umrah moments a traveller acts on. In-app
 * notifications are written by SQL; this adds the out-of-app channels.
 * Best-effort: a failed delivery never undoes the action that caused it.
 * An agency booking messages the agency, since the pilgrim may have no account.
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

@Injectable()
export class UmrahNotifyService {
  /** Fire and forget. */
  send(bookingId: string, kind: UmrahNotifyKind, line?: string, stage?: string): void {
    void this.deliver(bookingId, kind, line, stage).catch(() => {});
  }

  private async deliver(bookingId: string, kind: UmrahNotifyKind, line?: string, stage?: string) {
    const stageKey = stage ?? "confirmed";
    if (kind === "stage_changed" && !STAGE_LINES[stageKey]) return;
    const text =
      line ?? (kind === "stage_changed" ? STAGE_LINES[stageKey] : DEFAULT_LINES[kind]) ?? "Your booking was updated.";

    const admin = createAdminClient();
    const { data: booking } = await admin
      .from("umrah_bookings")
      .select(
        "id, customer_id, agency_id, agency:agency_id(contact_email, contact_phone), order_items(order:order_id(id, order_number, created_at))"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const orders = ((booking.order_items ?? []) as { order: unknown }[])
      .map((i) => one(i.order as { id: string; order_number: string; created_at: string } | null))
      .filter((o): o is { id: string; order_number: string; created_at: string } => !!o)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const order = orders[0];
    if (!order) return;

    const agency = one(booking.agency as unknown as { contact_email: string | null; contact_phone: string | null } | null);
    let email = agency?.contact_email ?? null;
    let phone = agency?.contact_phone ?? null;
    if (!booking.agency_id) {
      const { data: profile } = await admin.from("profiles").select("email, phone").eq("id", booking.customer_id).maybeSingle();
      email = profile?.email ?? null;
      phone = profile?.phone ?? null;
    }

    const site = env().NEXT_PUBLIC_SITE_URL ?? "";
    const url = booking.agency_id ? `${site}/agent/bookings/${order.id}` : `${site}/account/bookings/${order.id}`;
    const subject = `${SUBJECTS[kind]} — ${order.order_number}`;
    await dispatchToCustomer({
      profileId: booking.customer_id,
      email,
      phone,
      content: {
        en: {
          subject,
          text: `${order.order_number}: ${text}\n${url}`,
          html: `<p><strong>${escapeHtml(order.order_number)}</strong></p><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url)}">Open your booking</a></p>`,
        },
      },
      critical: kind === "booking_cancelled",
    });
  }
}
