import "server-only";
import { eventTypeLabel } from "@sts/shared-types";
import { createClient } from "@/lib/supabase/server";
import type { RefundRule } from "@/modules/hotels/refund-queries";
import type { RefundQuote } from "@/modules/hotels/refund-queries";
import { getHallRefundQuote } from "@/modules/events/hall-detail-queries";

export type VenueRequest = {
  id: string;
  kind: "cancellation" | "refund" | "modification";
  status: string;
  reason: string;
  requestedAmount: number | null;
  approvedAmount: number | null;
  staffNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  orderNumber: string | null;
  bookingId: string;
  clientName: string;
  eventLabel: string;
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  quote: RefundQuote | null;
};

export async function getVenueRefundRules(venueId: string): Promise<RefundRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_refund_rules")
    .select("id, days_before, deduction_percent")
    .eq("venue_id", venueId)
    .order("days_before", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, daysBefore: r.days_before, deductionPercent: Number(r.deduction_percent) }));
}

/** Customer requests routed to this venue's bookings, newest first. */
export async function getVenueRequests(venueId: string): Promise<VenueRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select(
      `id, kind, status, reason, requested_amount, approved_amount, staff_note, created_at, resolved_at,
       order:orders(order_number),
       booking:hall_bookings!booking_requests_hall_booking_id_fkey!inner(id, venue_id, event_type, event_name, start_date, end_date, price, currency, contact_name)`
    )
    .eq("booking.venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  const quotes = await Promise.all(
    rows.map((r) => (r.status === "requested" || r.status === "in_review" ? getHallRefundQuote(r.booking.id) : Promise.resolve(null)))
  );
  return rows.map((r, i) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    reason: r.reason,
    requestedAmount: r.requested_amount === null ? null : Number(r.requested_amount),
    approvedAmount: r.approved_amount === null ? null : Number(r.approved_amount),
    staffNote: r.staff_note,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    orderNumber: r.order?.order_number ?? null,
    bookingId: r.booking.id,
    clientName: r.booking.contact_name ?? "Client",
    eventLabel: r.booking.event_name || eventTypeLabel(r.booking.event_type),
    startDate: r.booking.start_date,
    endDate: r.booking.end_date,
    price: Number(r.booking.price),
    currency: r.booking.currency,
    quote: quotes[i],
  }));
}

export async function getOpenVenueRequestCount(venueId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("booking_requests")
    .select("id, booking:hall_bookings!booking_requests_hall_booking_id_fkey!inner(venue_id)", { count: "exact", head: true })
    .eq("booking.venue_id", venueId)
    .in("status", ["requested", "in_review"]);
  return count ?? 0;
}
