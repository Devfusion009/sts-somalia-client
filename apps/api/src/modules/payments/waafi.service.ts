import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { queryWaafiTransaction, validWaafiRedirect, type WaafiVerifiedTransaction, type WaafiConfig } from "@sts/shared-types/dist/waafi-server";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { getWaafiForSettlement } from "../../infra/payment-config";

export type WaafiSettlement = "paid" | "pending" | "failed" | "ignored";
export type WaafiWebhook = {
  event?: string; merchant_uid?: string;
  payment?: { reference_id?: string; transaction_id?: string; original_transaction_id?: string; amount?: number; currency?: string; status?: string };
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class WaafiService {
  private readonly logger = new Logger(WaafiService.name);
  private reconciling = false;
  constructor(private readonly admin: AdminSupabaseService) {}

  async getStatus(referenceId: string): Promise<{ status: WaafiSettlement; redirectUrl?: string }> {
    const gateway = await getWaafiForSettlement();
    if (!gateway) return { status: "ignored" };
    const { data: attempt, error } = await this.admin.get().from("waafi_payment_attempts").select("status, result")
      .eq("reference_id", referenceId).eq("environment", gateway.environment).eq("merchant_uid", gateway.merchantUid).maybeSingle();
    if (error) throw new Error("Payment status is unavailable.");
    if (!attempt) return { status: "ignored" };
    const status = attempt.status === "succeeded" ? "paid" : attempt.status === "failed" ? "failed" : "pending";
    const result = attempt.result as { type?: string; url?: string } | null;
    return { status, ...(status === "pending" && result?.type === "redirect" && validWaafiRedirect(result.url, gateway.environment) ? { redirectUrl: result.url } : {}) };
  }

  /** Browser returns and reconciliation always obtain fresh provider evidence. */
  async settle(referenceId: string): Promise<WaafiSettlement> {
    const gateway = await getWaafiForSettlement();
    if (!gateway || !uuid.test(referenceId)) return "ignored";
    const { data: receipt, error } = await this.admin.get().from("waafi_receipts").select("reference_id")
      .eq("reference_id", referenceId).eq("environment", gateway.environment).eq("merchant_uid", gateway.merchantUid).maybeSingle();
    if (error) throw new Error("Payment receipt lookup failed.");
    if (receipt) return "paid";
    const transaction = await queryWaafiTransaction(referenceId, gateway);
    return transaction ? this.apply(transaction, gateway) : "pending";
  }

  /** Only the signature-verifying controller calls this with a webhook body. */
  async processWebhook(event: WaafiWebhook, eventId: string, gateway: WaafiConfig): Promise<WaafiSettlement> {
    if (event.merchant_uid !== gateway.merchantUid) return "ignored";
    const db = this.admin.get();
    const { data: seen, error } = await db.from("waafi_webhook_events").select("event_id")
      .eq("environment", gateway.environment).eq("merchant_uid", gateway.merchantUid).eq("event_id", eventId).maybeSingle();
    if (error) throw new Error("Webhook receipt lookup failed.");
    if (seen) return "ignored";
    const payment = event.payment;
    if (event.event === "refund" || event.event === "void") {
      const { error: reviewError } = await db.rpc("record_waafi_review_event", {
        p_environment: gateway.environment, p_merchant_uid: gateway.merchantUid, p_event_id: eventId,
        p_event_name: event.event, p_reference_id: payment?.reference_id ?? "",
        p_transaction_id: payment?.original_transaction_id ?? payment?.transaction_id ?? "",
      });
      if (reviewError) throw new Error("Payment review event could not be recorded.");
      return "ignored";
    }
    if (!payment?.reference_id || !uuid.test(payment.reference_id) || payment.amount == null || !payment.currency || !payment.status) return "ignored";
    const state = payment.status.toUpperCase();
    if (event.event !== "authorization" && event.event !== "declined") return "ignored";
    if (state === "APPROVED" && event.event !== "authorization") return "ignored";
    return this.apply({ referenceId: payment.reference_id, transactionId: payment.transaction_id ?? "",
      amount: Number(payment.amount), currency: payment.currency.toUpperCase(), status: state }, gateway, eventId);
  }

  private async apply(tx: WaafiVerifiedTransaction, gateway: WaafiConfig, eventId?: string): Promise<WaafiSettlement> {
    const db = this.admin.get();
    const { data: attempt, error } = await db.from("waafi_payment_attempts").select("reference_id, amount, currency, status")
      .eq("reference_id", tx.referenceId).eq("environment", gateway.environment).eq("merchant_uid", gateway.merchantUid).maybeSingle();
    if (error) throw new Error("Payment attempt lookup failed.");
    if (!attempt) return "ignored";
    if (!Number.isFinite(tx.amount) || tx.amount <= 0 || tx.amount !== Number(attempt.amount) || tx.currency !== attempt.currency) {
      this.logger.error(`WaafiPay verification mismatch: ${tx.referenceId}`);
      throw new Error("Payment verification mismatch.");
    }
    if (tx.status === "APPROVED") {
      if (!tx.transactionId || tx.transactionId === "0") throw new Error("Missing payment transaction reference.");
      const { error: settlementError } = await db.rpc("settle_waafi_transaction", {
        p_reference_id: tx.referenceId, p_environment: gateway.environment, p_merchant_uid: gateway.merchantUid,
        p_transaction_id: tx.transactionId, p_amount: tx.amount, p_currency: tx.currency,
        ...(eventId ? { p_event_id: eventId } : {}),
      });
      if (settlementError) throw new Error("Payment settlement needs reconciliation.");
      return "paid";
    }
    if (attempt.status === "succeeded") return "paid"; // late failures cannot reverse an authorization
    // A declined lookup may describe an open HPP session; a signed declined event is final.
    if (["FAILED", "CANCELLED", "EXPIRED"].includes(tx.status) || (eventId && tx.status === "DECLINED")) {
      const { error: failError } = await db.rpc("fail_waafi_attempt", { p_reference_id: tx.referenceId });
      if (failError) throw new Error("Payment failure could not be recorded.");
      if (eventId) {
        const { error: receiptError } = await db.from("waafi_webhook_events").upsert({
          environment: gateway.environment, merchant_uid: gateway.merchantUid, event_id: eventId,
          event_name: "declined", reference_id: tx.referenceId, transaction_id: tx.transactionId,
        }, { onConflict: "environment,merchant_uid,event_id", ignoreDuplicates: true });
        if (receiptError) throw new Error("Webhook result could not be recorded.");
      }
      return "failed";
    }
    return "pending";
  }

  /** Always-on API worker: payment completion never depends on keeping a browser open. */
  @Interval(60_000)
  async reconcilePending(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const gateway = await getWaafiForSettlement();
      if (!gateway?.hpp) return;
      const db = this.admin.get();
      const { data, error } = await db.from("waafi_payment_attempts").select("reference_id")
        .eq("environment", gateway.environment).eq("merchant_uid", gateway.merchantUid)
        .in("status", ["initiating", "pending"]).lt("created_at", new Date(Date.now() - 30_000).toISOString())
        .order("checked_at", { ascending: true, nullsFirst: true }).limit(5);
      if (error) throw new Error("Pending payment lookup failed.");
      for (const row of data ?? []) {
        // Mark the visit before network I/O so an unreachable reference cannot starve newer ones.
        const { error: checkError } = await db.from("waafi_payment_attempts").update({ checked_at: new Date().toISOString() }).eq("reference_id", row.reference_id);
        if (checkError) continue;
        await db.rpc("flag_waafi_reconciliation", { p_reference_id: row.reference_id });
        try { await this.settle(row.reference_id); }
        catch { this.logger.warn(`WaafiPay reconciliation pending: ${row.reference_id}`); }
      }
    } catch { this.logger.warn("WaafiPay reconciliation is unavailable."); }
    finally { this.reconciling = false; }
  }
}
