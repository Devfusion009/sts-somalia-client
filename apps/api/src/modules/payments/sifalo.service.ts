import { Injectable, Logger } from "@nestjs/common";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { getPaymentGateways } from "../../infra/payment-config";

export type SifaloSettlement = "paid" | "pending" | "failed" | "ignored";

type VerifyResponse = {
  status?: string;
  code?: string | number;
  amount?: string | number;
  currency?: string;
  payment_type?: string;
};

/** What the customer paid with, as recorded on the payment and the invoice. */
function methodLabel(paymentType: string | undefined): string {
  switch ((paymentType ?? "").toUpperCase()) {
    case "CARD":
      return "Visa / Mastercard (Sifalo Pay)";
    case "EDAHAB":
      return "eDahab (Sifalo Pay)";
    case "PREMIER WALLET":
      return "Premier Wallet (Sifalo Pay)";
    case "":
      return "Sifalo Pay";
    default:
      return "EVC Plus / ZAAD / Sahal (Sifalo Pay)";
  }
}

/**
 * Settles Sifalo Pay payments. The webhook and the browser return carry
 * unauthenticated input, so neither is trusted: every settlement re-verifies
 * the sid with Sifalo and requires status "success", code 601 and the exact
 * amount and currency of the payment row.
 */
@Injectable()
export class SifaloService {
  private readonly logger = new Logger(SifaloService.name);

  constructor(private readonly admin: AdminSupabaseService) {}

  async settle(paymentId: string, sid: string): Promise<SifaloSettlement> {
    const gateway = (await getPaymentGateways()).sifalo;
    if (!gateway || !paymentId || !sid) return "ignored";

    const db = this.admin.get();
    const { data: payment } = await db
      .from("payments")
      .select("id, provider, status, amount, currency")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment || payment.provider !== "sifalo") return "ignored";
    if (payment.status === "succeeded") return "paid";

    let verified: VerifyResponse;
    try {
      const res = await fetch(gateway.verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
        signal: AbortSignal.timeout(120_000),
      });
      verified = (await res.json()) as VerifyResponse;
    } catch {
      this.logger.warn(`Sifalo verify unreachable for payment ${paymentId}`);
      return "pending";
    }

    const code = String(verified.code ?? "");
    if (verified.status === "success" && code === "601") {
      const amountMatches = Math.abs(Number(verified.amount) - Number(payment.amount)) < 0.01;
      const currencyMatches = (verified.currency ?? "").toUpperCase() === payment.currency.toUpperCase();
      if (!amountMatches || !currencyMatches) {
        this.logger.error(`Sifalo amount mismatch on payment ${paymentId}: ${verified.amount} ${verified.currency}`);
        return "ignored";
      }

      // A sid pays exactly one payment row.
      const { data: reused } = await db
        .from("payments")
        .select("id")
        .eq("provider", "sifalo")
        .eq("provider_ref", sid)
        .neq("id", paymentId)
        .limit(1);
      if (reused && reused.length > 0) return "ignored";

      await db
        .from("payments")
        .update({ status: "succeeded", provider_ref: sid, method_label: methodLabel(verified.payment_type) })
        .eq("id", paymentId)
        .neq("status", "succeeded");
      return "paid";
    }

    if (code === "603") return "pending";
    if (code === "600" || code === "604") {
      await db.from("payments").update({ status: "failed" }).eq("id", paymentId).neq("status", "succeeded");
      return "failed";
    }
    return "ignored";
  }
}
