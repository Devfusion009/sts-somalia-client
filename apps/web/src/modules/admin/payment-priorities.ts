import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type PaymentPriority = {
  id: string; order_id: string; amount: number; currency: string; created_at: string;
  order: { order_number: string; customer: { full_name: string | null } | null; agency_customer: { full_name: string | null } | null };
  proofs?: { id: string; transfer_reference: string | null; created_at: string }[];
};

/** Exact totals cover the entire queue; only a small oldest-first preview loads details. */
export async function getPaymentPriorities() {
  const db = await createClient() as unknown as SupabaseClient;
  const payable = ["pending_payment", "held", "partially_paid"];
  const base = "id,order_id,amount,currency,created_at,order:orders!inner(order_number,status,customer:profiles!orders_customer_id_fkey(full_name),agency_customer:agency_customer_id(full_name))";
  const [bank, cash] = await Promise.all([
    db.from("payments").select(`${base},proofs:payment_proofs!inner(id,status,transfer_reference,created_at)`, { count: "exact" })
      .eq("provider", "manual").eq("method_label", "Bank Transfer").eq("status", "requires_action")
      .in("order.status", payable).eq("proofs.status", "submitted")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(3),
    db.from("payments").select(base, { count: "exact" })
      .eq("provider", "manual").eq("method_label", "Pay at Office").eq("status", "requires_action")
      .in("order.status", payable)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(3),
  ]);
  return {
    bank: { count: bank.count ?? 0, error: Boolean(bank.error), rows: bank.error ? [] : (bank.data ?? []) as unknown as PaymentPriority[] },
    cash: { count: cash.count ?? 0, error: Boolean(cash.error), rows: cash.error ? [] : (cash.data ?? []) as unknown as PaymentPriority[] },
  };
}
