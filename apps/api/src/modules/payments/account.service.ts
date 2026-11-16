import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { Database, SaveWalletMethodInput } from "@sts/shared-types";

/**
 * Direct port of apps/web's modules/payments/{account-actions,account-queries}.ts.
 * Only ever stores a wallet number (mobile-money msisdn) — never card data;
 * confirmed by reading the actual insert below, not assumed.
 */
@Injectable()
export class AccountPaymentsService {
  constructor(private readonly rls: RlsSupabaseService) {}

  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  async getMySavedPaymentMethods(profileId: string) {
    const { data, error } = await this.rls
      .get()
      .from("payment_methods")
      .select("*")
      .eq("customer_id", profileId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error("Saved wallets could not be loaded.");
    return data ?? [];
  }

  /** The customer's orders, collected receipts and unpaid invoices in one workspace. */
  async getMyReceipts(profileId: string) {
    const { data, error } = await this.db()
      .from("orders")
      .select(
        "id, order_number, status, total, currency, created_at, paid_at, invoices(invoice_number, status, issued_at), payments(id, provider, status, amount, currency, created_at, paid_at), order_items(id, item_type), booking_requests(kind, status, approved_amount, currency)"
      )
      .or(`customer_id.eq.${profileId},booked_by.eq.${profileId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Payments and invoices could not be loaded.");
    return data ?? [];
  }

  /**
   * Refunds in flight and refunds settled. Two sources because a refund has
   * two halves that can each exist without the other: the customer's
   * request (booking_requests) and the money actually moving
   * (payments.status).
   */
  async getMyRefunds(profileId: string) {
    const db = this.db();
    const [requestsRes, paymentsRes] = await Promise.all([
      db
        .from("booking_requests")
        .select("*, orders(order_number)")
        .eq("requested_by", profileId)
        .eq("kind", "refund")
        .order("created_at", { ascending: false }),
      db
        .from("payments")
        .select("id, amount, currency, status, created_at, updated_at, orders!inner(order_number, customer_id, booked_by)")
        .in("status", ["refunded", "partially_refunded"])
        .or(`customer_id.eq.${profileId},booked_by.eq.${profileId}`, { referencedTable: "orders" })
        .order("updated_at", { ascending: false }),
    ]);

    if (requestsRes.error || paymentsRes.error) throw new Error("Refunds could not be loaded.");
    return {
      requests: requestsRes.data ?? [],
      // The !inner join with .or() can still admit agency-visible rows;
      // narrow to the customer's own, matching the original.
      settled: (paymentsRes.data ?? []).filter((p) => p.orders.customer_id === profileId || p.orders.booked_by === profileId),
    };
  }

  /** Saves a mobile-money number for reuse at checkout. Cannot move money — a convenience store only. */
  async saveWalletMethod(profileId: string, input: SaveWalletMethodInput): Promise<{ error: string | null }> {
    const supabase = this.rls.get();

    // Clearing the previous default BEFORE writing this one keeps the
    // payment_methods_one_default_per_customer partial unique index satisfied.
    if (input.makeDefault) {
      await supabase.from("payment_methods").update({ is_default: false }).eq("customer_id", profileId).eq("is_default", true);
    }

    const row = {
      provider: input.provider,
      kind: "mobile_money" as const,
      msisdn: input.msisdn,
      label: input.label,
      is_default: input.makeDefault,
    };

    if (input.methodId) {
      const { error } = await supabase.from("payment_methods").update(row).eq("id", input.methodId).eq("customer_id", profileId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("payment_methods").insert({ customer_id: profileId, ...row });
      if (error) return { error: error.message };
    }
    return { error: null };
  }

  async deleteWalletMethod(profileId: string, methodId: string) {
    await this.rls.get().from("payment_methods").delete().eq("id", methodId).eq("customer_id", profileId);
  }

  /** Promotes one saved method to default, demoting whichever held it before. */
  async setDefaultWalletMethod(profileId: string, methodId: string) {
    const supabase = this.rls.get();
    await supabase.from("payment_methods").update({ is_default: false }).eq("customer_id", profileId).eq("is_default", true);
    await supabase.from("payment_methods").update({ is_default: true }).eq("id", methodId).eq("customer_id", profileId);
  }
}
