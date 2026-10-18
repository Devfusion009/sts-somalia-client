import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hotelGuestNames } from "@/modules/orders/format";

export type RefundRule = { id: string; daysBefore: number; deductionPercent: number };

export type RefundQuote = {
  daysBefore: number;
  /** Null when the hotel has no rules: the amount is the hotel's call. */
  deductionPercent: number | null;
  paidAmount: number;
  refundAmount: number | null;
  currency: string;
};

export type HotelRequest = {
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
  guestName: string;
  roomName: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  currency: string;
  quote: RefundQuote | null;
};

export async function getRefundRules(hotelId: string): Promise<RefundRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_refund_rules")
    .select("id, days_before, deduction_percent")
    .eq("hotel_id", hotelId)
    .order("days_before", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    daysBefore: r.days_before,
    deductionPercent: Number(r.deduction_percent),
  }));
}

/** What cancelling this booking today would refund under the hotel's rules. */
export async function getRefundQuote(bookingId: string): Promise<RefundQuote | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("hotel_refund_quote", { p_booking_id: bookingId });
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

/** Customer requests routed to this hotel's bookings, newest first. */
export async function getHotelRequests(hotelId: string): Promise<HotelRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select(
      `id, kind, status, reason, requested_amount, approved_amount, staff_note, created_at, resolved_at, hotel_booking_id,
       order:orders(order_number),
       booking:hotel_bookings!booking_requests_hotel_booking_id_fkey!inner(id, hotel_id, check_in, check_out, total_price, currency, guest_details, room:hotel_rooms(name))`
    )
    .eq("booking.hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  const quotes = await Promise.all(
    rows.map((r) =>
      r.status === "requested" || r.status === "in_review" ? getRefundQuote(r.booking.id) : Promise.resolve(null)
    )
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
    guestName: hotelGuestNames(r.booking.guest_details)[0] ?? "Guest",
    roomName: r.booking.room?.name ?? null,
    checkIn: r.booking.check_in,
    checkOut: r.booking.check_out,
    totalPrice: Number(r.booking.total_price),
    currency: r.booking.currency,
    quote: quotes[i],
  }));
}

export async function getOpenRequestCount(hotelId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("booking_requests")
    .select("id, booking:hotel_bookings!booking_requests_hotel_booking_id_fkey!inner(hotel_id)", {
      count: "exact",
      head: true,
    })
    .eq("booking.hotel_id", hotelId)
    .in("status", ["requested", "in_review"]);
  return count ?? 0;
}
