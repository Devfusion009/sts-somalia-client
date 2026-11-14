import { ACTIONABLE_TYPES } from "./actionable-types";

/**
 * Where each notification opens, per portal. Shared by the in-app bells and
 * the notification emails, so a toast's "Open" and an email's button always
 * land on the same page. Paths are portal-relative; callers add the origin.
 */
export type NotificationLike = { type: string; data?: unknown };

export function newOrderHref(n: { data?: unknown }): string | null {
  const orderId = (n.data as { order_id?: string } | null)?.order_id;
  return orderId ? `/admin/orders?order=${orderId}#order-${orderId}` : null;
}

export function agentNotificationHref(n: NotificationLike): string | null {
  if (n.type === "low_balance") return "/agent/finance";
  if (n.type === "earnings_reviewed") return "/agent/finance";
  if (n.type === "payout_request_reviewed" || n.type === "payout_paid" || n.type === "payout_sent" || n.type === "payout_failed") {
    return "/agent/finance/withdrawals";
  }
  if (n.type === "topup_reviewed") return "/agent/finance/top-up";
  if (n.type === "markup_request_reviewed") return "/agent/markups";
  if (n.type === "partner_onboarding_reminder") return "/agent";
  // The agent portal has no per-application visa view yet (that arrives with
  // the desk in M7), so this lands on the filtered agency bookings list.
  if (n.type === "visa_status_changed" || n.type === "visa_documents_reminder" || n.type === "visa_auto_cancelled" || n.type === "visa_refusal_credit") {
    return "/agent/bookings?type=visa";
  }
  // Every umrah_* notification (stage, cancellation, quote, documents,
  // reminders, travel changes) carries the order it belongs to.
  if (n.type.startsWith("umrah_")) {
    const data = n.data as { orderId?: string } | null;
    return data?.orderId ? `/agent/bookings/${data.orderId}` : "/agent/bookings?type=umrah";
  }
  if (n.type === "flight_booked" || n.type === "flight_ticketed" || n.type === "flight_booking_delayed") {
    const orderId = (n.data as { order_id?: string } | null)?.order_id;
    return orderId ? `/agent/bookings/${orderId}` : "/agent/bookings";
  }
  if (n.type === "wallet_booking_payment") {
    const data = n.data as { orderId?: string } | null;
    return data?.orderId ? `/agent/book/order/${data.orderId}` : "/agent/bookings";
  }
  if (ACTIONABLE_TYPES.has(n.type) || n.type === "application_documents_verified") return "/account/become";
  return null;
}

export function customerNotificationHref(n: NotificationLike): string | null {
  // A decided application opens its own page, where the progress track shows the outcome.
  if (n.type === "application_approved" || n.type === "application_rejected") {
    const d = n.data as { applicationType?: string; applicationId?: string } | null;
    if (d?.applicationType && d.applicationId) return `/account/become/${d.applicationType}/${d.applicationId}/view`;
  }
  if (ACTIONABLE_TYPES.has(n.type)) return "/account/become";
  if (
    n.type === "booking_waitlisted" ||
    n.type === "booking_confirmed" ||
    n.type === "booking_declined" ||
    n.type === "order_paid" ||
    n.type === "flight_booked" ||
    n.type === "flight_ticketed" ||
    n.type === "flight_booking_delayed" ||
    n.type.startsWith("booking_request_")
  ) {
    const orderId = (n.data as { order_id?: string } | null)?.order_id;
    return orderId ? `/account/bookings/${orderId}` : "/account/bookings";
  }
  // Every umrah_* notification (stage, cancellation, quote, documents,
  // reminders, travel changes) carries the order it belongs to.
  if (n.type.startsWith("umrah_")) {
    const orderId = (n.data as { orderId?: string } | null)?.orderId;
    return orderId ? `/account/bookings/${orderId}` : "/account/bookings";
  }
  if (n.type === "visa_status_changed" || n.type === "visa_documents_reminder" || n.type === "visa_auto_cancelled" || n.type === "visa_refusal_credit") {
    const applicationId = (n.data as { applicationId?: string } | null)?.applicationId;
    return applicationId ? `/account/visa/${applicationId}` : "/account/visa";
  }
  return null;
}

export function adminNotificationHref(n: NotificationLike): string | null {
  if (n.type === "new_order") return newOrderHref(n) ?? "/admin/orders";
  if (n.type === "flight_ticketing_failed") return "/admin/flights?view=attention";
  if (n.type === "private_umrah_request") return "/admin/umrah/requests?status=pending";
  if (n.type === "payout_request") return "/admin/finance/withdrawals?status=pending";
  if (n.type === "visa_application_submitted" || n.type === "visa_status_changed" || n.type === "visa_case_attention") {
    const applicationId = (n.data as { applicationId?: string } | null)?.applicationId;
    if (applicationId) return `/admin/visa/${applicationId}`;
  }
  if (n.type === "markup_request" || n.type === "wallet_booking_payment") {
    const data = n.data as { agencyId?: string } | null;
    if (data?.agencyId) return `/admin/agencies/${data.agencyId}`;
  }
  if (n.type === "application_document_resubmitted" || n.type === "application_submitted" || n.type === "application_updated") {
    const data = n.data as { applicationType?: string; applicationId?: string } | null;
    if (data?.applicationType && data?.applicationId) {
      return `/admin/applications/${data.applicationType.replace("_", "-")}/${data.applicationId}`;
    }
  }
  return null;
}
