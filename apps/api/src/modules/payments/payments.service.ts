import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { OrdersService } from "../orders/orders.service";
import { SifaloService, type SifaloSettlement } from "./sifalo.service";
import { WaafiService } from "./waafi.service";
import { getPaymentMethod } from "./registry";
import { initiateWithProvider } from "./providers";
import type { InitiationResult, InitiatePaymentInput, RecordPaymentInput } from "@sts/shared-types";
import { MIN_DEPOSIT_FRACTION, hallAwaitingQuote } from "@sts/shared-types";

const PAYABLE_ORDER_STATUSES = ["pending_payment", "held", "partially_paid"] as const;
const phonePattern = /^\+?[0-9][0-9\s-]{6,14}$/;

/**
 * Direct port of apps/web's modules/payments/actions.ts. Real money-handling
 * logic — ported behavior-preserving, not "improved". redirect()/revalidatePath
 * (Next.js-specific) removed; callers get a plain result and decide navigation,
 * same as every other phase.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly rls: RlsSupabaseService,
    private readonly admin: AdminSupabaseService,
    private readonly orders: OrdersService,
    private readonly sifalo: SifaloService,
    private readonly waafi: WaafiService
  ) {}

  /** Sum of this order's already-succeeded payments — the source of truth for balance due. */
  private async getPaidTotal(supabase: SupabaseClient, orderId: string): Promise<number> {
    const { data } = await supabase.from("payments").select("amount").eq("order_id", orderId).eq("status", "succeeded");
    return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  }

  async initiatePayment(
    userId: string,
    input: InitiatePaymentInput
  ): Promise<{ error: string | null; result?: InitiationResult; orderId?: string }> {
    const supabase = this.rls.get();

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, status, total, currency, agency_id, min_first_payment")
      .eq("id", input.orderId)
      .maybeSingle();

    if (!order) return { error: "We could not find this order." };
    if (!PAYABLE_ORDER_STATUSES.includes(order.status as (typeof PAYABLE_ORDER_STATUSES)[number])) {
      return { error: "This order is not awaiting payment." };
    }

    const { data: stayItems } = await supabase
      .from("order_items")
      .select("hotel_booking:hotel_booking_id (status), hall_booking:hall_booking_id (status)")
      .eq("order_id", order.id);
    const waiting = (stayItems ?? []).some((item) => {
      const hotel = item.hotel_booking as unknown as { status: string } | null;
      const hall = item.hall_booking as unknown as { status: string } | null;
      return hotel?.status === "waitlisted" || hall?.status === "waitlisted";
    });
    if (waiting) return { error: "This booking is waiting for confirmation." };

    const { data: hallItems } = await supabase
      .from("order_items")
      .select("hall_booking:hall_booking_id (status, start_time, venue:venue_id (price_unit, base_price))")
      .eq("order_id", order.id)
      .not("hall_booking_id", "is", null);
    type HallQuoteRow = Parameters<typeof hallAwaitingQuote>[0];
    const halls = (hallItems ?? []).map((item) => item.hall_booking as unknown as HallQuoteRow | null);
    if (halls.some((hall) => hall !== null && hallAwaitingQuote(hall))) {
      return { error: "The venue hasn't confirmed the price yet." };
    }

    const paidTotal = await this.getPaidTotal(supabase, order.id);
    const remaining = Number(order.total) - paidTotal;
    if (remaining <= 0) return { error: "This order is already fully paid." };

    let amount = input.amount ?? remaining;
    amount = Math.round(amount * 100) / 100;
    if (amount > remaining + 0.01) {
      return { error: `That's more than the remaining balance of ${order.currency} ${remaining.toFixed(2)}.` };
    }
    // An Umrah package may set its own deposit share (orders.min_first_payment,
    // computed in SQL); everything else uses the platform-wide fraction.
    const minFirstPayment =
      order.min_first_payment != null
        ? Number(order.min_first_payment)
        : Math.round(Number(order.total) * MIN_DEPOSIT_FRACTION * 100) / 100;
    if (paidTotal === 0 && amount < minFirstPayment - 0.01) {
      return {
        error: `The first payment must be at least ${order.currency} ${minFirstPayment.toFixed(2)}.`,
      };
    }

    if (input.methodId === "agency_wallet") {
      return this.payFromAgencyWallet(userId, order, amount);
    }

    const method = await getPaymentMethod(input.methodId);
    if (!method) return { error: "That payment method is not available." };
    if (method.requiresPhone && !phonePattern.test(input.payerPhone ?? "")) {
      return { error: `Enter the ${method.label} mobile number to charge.` };
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider: method.provider,
        method_label: method.label,
        amount,
        currency: order.currency,
        status: "processing",
        payer_phone: method.requiresPhone ? input.payerPhone : null,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      return { error: paymentError?.message ?? "Could not start the payment." };
    }

    let result: InitiationResult;
    try {
      result = await initiateWithProvider({
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.order_number,
        amount,
        currency: order.currency,
        description: `STS Travel order ${order.order_number}`,
        method,
        payerPhone: input.payerPhone,
      });
    } catch {
      result = { type: "error", message: "The payment provider did not respond. Please try again." };
    }

    // Settlement writes go through the service role: customers have no
    // UPDATE rights on payments, so state changes stay server-authoritative.
    const admin = this.admin.get();

    switch (result.type) {
      case "success": {
        await admin.from("payments").update({ status: "succeeded", provider_ref: result.providerRef ?? null }).eq("id", payment.id);
        return { error: null, result, orderId: order.id };
      }
      case "redirect":
        await admin.from("payments").update({ provider_ref: result.providerRef ?? null }).eq("id", payment.id);
        return { error: null, result, orderId: order.id };
      case "instructions":
        await admin
          .from("payments")
          .update({ status: "requires_action", instructions: result.instructions, provider_ref: result.providerRef ?? null })
          .eq("id", payment.id);
        return { error: null, result, orderId: order.id };
      case "error":
        await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
        return { error: result.message };
    }
  }

  /**
   * B2B pay-from-balance: debits the agency wallet (credit limit allows
   * going negative — "book now, settle weekly") and settles the order in
   * one step. The debit is authorized in Postgres:
   * apply_agency_wallet_transaction re-checks membership, order ownership,
   * and available balance atomically.
   */
  private async payFromAgencyWallet(
    profileId: string,
    order: { id: string; order_number: string; currency: string; agency_id: string | null },
    amount: number
  ): Promise<{ error: string | null; result?: InitiationResult; orderId?: string }> {
    if (!order.agency_id) {
      return { error: "This order is not an agency booking." };
    }
    const agencyId = await this.orders.getActiveAgencyId(profileId);
    if (agencyId !== order.agency_id) {
      return { error: "Only members of the booking agency can pay from its balance." };
    }

    const supabase = this.rls.get();
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "wallet",
        method_label: "Agency Balance",
        amount,
        currency: order.currency,
        status: "processing",
      })
      .select()
      .single();
    if (paymentError || !payment) {
      return { error: paymentError?.message ?? "Could not start the payment." };
    }

    const admin = this.admin.get();
    const { error: walletError } = await supabase.rpc("apply_agency_wallet_transaction", {
      target_agency_id: order.agency_id,
      tx_amount: -amount,
      tx_type: "booking_payment",
      target_order_id: order.id,
      tx_note: `Order ${order.order_number}`,
    });

    if (walletError) {
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return {
        error: walletError.message.includes("insufficient")
          ? "Your agency balance (including credit limit) doesn't cover this order — top up with STS or choose another method."
          : walletError.message,
      };
    }

    await admin.from("payments").update({ status: "succeeded" }).eq("id", payment.id);
    return { error: null, result: { type: "success" }, orderId: order.id };
  }

  /** Customer abandons a pending manual payment to pick another method. */
  /**
   * The customer's browser returns from Sifalo's hosted checkout with a sid.
   * RLS proves the payment is theirs; SifaloService re-verifies with Sifalo.
   */
  async confirmSifaloReturn(paymentId: string, sid: string): Promise<{ status: SifaloSettlement; orderId: string | null }> {
    const { data: payment } = await this.rls.get().from("payments").select("id, order_id").eq("id", paymentId).maybeSingle();
    if (!payment) return { status: "ignored", orderId: null };
    return { status: await this.sifalo.settle(payment.id, sid), orderId: payment.order_id };
  }

  /** The customer's browser returns from WaafiPay's hosted page. RLS proves the payment is theirs; WaafiService re-reads the result from WaafiPay. */
  async confirmWaafiReturn(paymentId: string): Promise<{ status: SifaloSettlement; orderId: string | null }> {
    const { data: payment } = await this.rls.get().from("payments").select("id, order_id").eq("id", paymentId).maybeSingle();
    if (!payment) return { status: "ignored", orderId: null };
    return { status: await this.waafi.settle(payment.id), orderId: payment.order_id };
  }

  async cancelPendingPayment(paymentId: string) {
    const supabase = this.rls.get();
    // Visibility through RLS proves the caller may act on this payment.
    const { data: payment } = await supabase.from("payments").select("id, order_id, status").eq("id", paymentId).maybeSingle();
    if (!payment || payment.status !== "requires_action") return { ok: true };

    await this.admin.get().from("payments").update({ status: "failed" }).eq("id", payment.id);
    return { ok: true };
  }

  /** Admin marks a manual payment (bank transfer / cash) as received. Caller enforces admin via protectedAdminProcedure. */
  async adminConfirmPayment(paymentId: string) {
    await this.admin.get().from("payments").update({ status: "succeeded" }).eq("id", paymentId);
    return { ok: true };
  }

  /**
   * Admin logs a payment taken outside the online flow entirely — cash
   * handed over at the office, a bank transfer that arrived without the
   * customer going through "Pay at Office" first. Settles through the same
   * trigger as every other payment, so partial/full rollup stays correct.
   */
  async adminRecordPayment(input: RecordPaymentInput): Promise<{ error: string | null }> {
    const admin = this.admin.get();
    const { data: order } = await admin.from("orders").select("id, currency, total").eq("id", input.orderId).maybeSingle();
    if (!order) return { error: "We could not find this order." };

    const paidTotal = await this.getPaidTotal(admin, order.id);
    const remaining = Number(order.total) - paidTotal;
    if (input.amount > remaining + 0.01) {
      return { error: `That's more than the remaining balance of ${order.currency} ${remaining.toFixed(2)}.` };
    }

    const { error } = await admin.from("payments").insert({
      order_id: order.id,
      provider: "manual",
      method_label: input.methodLabel,
      amount: input.amount,
      currency: order.currency,
      status: "succeeded",
    });
    if (error) return { error: error.message };
    return { error: null };
  }
}
