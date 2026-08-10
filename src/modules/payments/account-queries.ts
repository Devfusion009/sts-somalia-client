import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { Database } from "@/lib/types/database.types";

export type SavedPaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

export async function getMySavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("customer_id", profile.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Receipt history: every order the customer has that carries a payment or an
 * invoice, newest first.
 *
 * Orders still at pending_payment are excluded — nothing has been received, so
 * there is no receipt to show, and listing them here would imply otherwise.
 */
export async function getMyReceipts() {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, currency, created_at, paid_at, invoices(invoice_number, status, issued_at), payments(id, provider, status, amount, currency, created_at)"
    )
    .or(`customer_id.eq.${profile.id},booked_by.eq.${profile.id}`)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export type Receipt = Awaited<ReturnType<typeof getMyReceipts>>[number];

/**
 * Refunds in flight and refunds settled.
 *
 * Two sources, because a refund has two halves that can each exist without the
 * other: the customer's request (booking_requests) and the money actually
 * moving (payments.status). A refund processed at the counter has no request
 * row; a request still under review has no payment row.
 */
export async function getMyRefunds() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [requestsRes, paymentsRes] = await Promise.all([
    supabase
      .from("booking_requests")
      .select("*, orders(order_number)")
      .eq("requested_by", profile.id)
      .eq("kind", "refund")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, currency, status, created_at, updated_at, orders!inner(order_number, customer_id, booked_by)")
      .in("status", ["refunded", "partially_refunded"])
      .or(`customer_id.eq.${profile.id},booked_by.eq.${profile.id}`, { referencedTable: "orders" })
      .order("updated_at", { ascending: false }),
  ]);

  return {
    requests: requestsRes.data ?? [],
    // The !inner join with .or() can still admit agency-visible rows; narrow to
    // the customer's own, matching the rest of the account section.
    settled: (paymentsRes.data ?? []).filter(
      (p) => p.orders.customer_id === profile.id || p.orders.booked_by === profile.id
    ),
  };
}
