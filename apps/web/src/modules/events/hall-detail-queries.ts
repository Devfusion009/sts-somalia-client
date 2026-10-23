import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RefundQuote } from "@/modules/hotels/refund-queries";

export type HallEventKind = "created" | "status" | "payment" | "refund" | "rescheduled" | "price";

export type HallEvent = {
  id: string;
  kind: HallEventKind;
  fromValue: string | null;
  toValue: string | null;
  actorId: string | null;
  createdAt: string;
};

export async function getHallRefundQuote(bookingId: string): Promise<RefundQuote | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("hall_refund_quote", { p_booking_id: bookingId });
  const row = data?.[0];
  if (!row) return null;
  return {
    daysBefore: row.days_before,
    deductionPercent: row.deduction_percent === null ? null : Number(row.deduction_percent),
    paidAmount: Number(row.paid_amount),
    refundAmount: row.refund_amount === null ? null : Number(row.refund_amount),
    currency: row.currency,
  };
}

/** One hall booking with its order, payment, open requests and activity. RLS scopes it to the caller. */
export async function getHallBookingDetail(venueId: string, bookingId: string) {
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("hall_bookings")
    .select(
      `id, venue_id, booking_ref, event_type, event_name, start_date, end_date, start_time, end_time, expected_guests,
       setup_requirements, customer_notes, admin_notes, price, currency, status, source, channel, contact_name, customer_id,
       contact_phone, contact_email, payment_method, paid_at, payment_reference, displaced_at, created_at,
       agency:agencies(name),
       order_items(order:orders(id, order_number, status, total, payments(id, provider, method_label, status, amount, created_at)))`
    )
    .eq("id", bookingId)
    .eq("venue_id", venueId)
    .maybeSingle();
  // A failed read must not render as "not found".
  if (error) throw error;
  if (!booking) return null;

  const [{ data: events }, { data: requests }] = await Promise.all([
    supabase
      .from("hall_booking_events")
      .select("id, kind, from_value, to_value, actor_id, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booking_requests")
      .select("id, kind, status, reason, approved_amount, created_at")
      .eq("hall_booking_id", bookingId)
      .order("created_at", { ascending: false }),
  ]);

  const order = booking.order_items?.[0]?.order ?? null;
  const succeededPayments = order?.payments?.filter((p) => p.status === "succeeded") ?? [];
  const succeeded = succeededPayments.at(-1) ?? null;
  const live = booking.status === "pending" || booking.status === "confirmed";

  return {
    booking,
    order: order
      ? {
          id: order.id,
          number: order.order_number,
          status: order.status,
          total: Number(order.total),
          paid: succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0),
          payments: [...(order.payments ?? [])].sort((a, z) => a.created_at.localeCompare(z.created_at)),
        }
      : null,
    onlinePayment: succeeded ? { provider: succeeded.provider, label: succeeded.method_label } : null,
    requests: requests ?? [],
    events: (events ?? []).map<HallEvent>((e) => ({
      id: e.id,
      kind: e.kind as HallEventKind,
      fromValue: e.from_value,
      toValue: e.to_value,
      actorId: e.actor_id,
      createdAt: e.created_at,
    })),
    quote: live ? await getHallRefundQuote(bookingId) : null,
  };
}

export type HallBookingDetail = NonNullable<Awaited<ReturnType<typeof getHallBookingDetail>>>;
