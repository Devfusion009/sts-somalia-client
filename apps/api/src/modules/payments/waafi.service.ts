import { Injectable, Logger } from "@nestjs/common";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { getPaymentGateways } from "../../infra/payment-config";

export type WaafiSettlement = "paid" | "pending" | "failed" | "ignored";

type ResultInfo = {
  responseCode?: string;
  params?: { referenceId?: string; transactionId?: string; amount?: string; currency?: string; status?: string };
};

/**
 * Settles WaafiPay hosted-page payments. The browser return carries
 * unauthenticated input, so it only names the payment: every settlement
 * re-reads the result from WaafiPay (HPP_GETTRANINFO) and requires state
 * APPROVED plus the exact amount, currency and reference of the payment row.
 */
@Injectable()
export class WaafiService {
  private readonly logger = new Logger(WaafiService.name);

  constructor(private readonly admin: AdminSupabaseService) {}

  async settle(paymentId: string): Promise<WaafiSettlement> {
    const gateway = (await getPaymentGateways()).waafi;
    if (!gateway?.hpp || !paymentId) return "ignored";

    const db = this.admin.get();
    const { data: payment } = await db
      .from("payments")
      .select("id, provider, status, amount, currency, provider_ref")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment || payment.provider !== "waafi") return "ignored";
    if (payment.status === "succeeded") return "paid";
    if (!["processing", "requires_action"].includes(payment.status)) return "ignored";

    let result: ResultInfo;
    try {
      const res = await fetch(gateway.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: "1.0",
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          channelName: "WEB",
          serviceName: "HPP_GETTRANINFO",
          serviceParams: {
            merchantUid: gateway.merchantUid,
            storeId: gateway.hpp.storeId,
            hppKey: gateway.hpp.hppKey,
            referenceId: payment.id,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return "pending";
      result = (await res.json()) as ResultInfo;
    } catch {
      this.logger.warn(`WaafiPay result lookup unreachable for payment ${paymentId}`);
      return "pending";
    }

    if (result.responseCode !== "2001" || !result.params) return "pending";
    const { referenceId, amount: txAmount, currency: currencyCode } = result.params;
    const state = result.params.status?.toUpperCase();
    if (referenceId !== payment.id) return "ignored";

    if (state === "APPROVED") {
      const amountMatches = txAmount != null && Number.isFinite(Number(txAmount)) && Number(txAmount) === Number(payment.amount);
      const currencyMatches = (currencyCode ?? "").toUpperCase() === payment.currency.toUpperCase();
      if (!amountMatches || !currencyMatches) {
        this.logger.error(`WaafiPay amount mismatch on payment ${paymentId}: ${txAmount} ${currencyCode}`);
        return "ignored";
      }
      const { error } = await db
        .from("payments")
        .update({ status: "succeeded", method_label: "EVC Plus / ZAAD / Sahal (WaafiPay)" })
        .eq("id", paymentId)
        .in("status", ["processing", "requires_action"]);
      return error ? "pending" : "paid";
    }

    // An open, unpaid hosted session also reads DECLINED, so that state stays pending.
    if (state === "FAILED" || state === "CANCELLED" || state === "EXPIRED") {
      await db.from("payments").update({ status: "failed" }).eq("id", paymentId).in("status", ["processing", "requires_action"]);
      return "failed";
    }
    return "pending";
  }
}
