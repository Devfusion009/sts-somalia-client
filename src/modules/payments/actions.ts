"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requirePlatformAdmin } from "@/lib/auth/session";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { getPaymentMethod } from "./registry";
import { initiateWithProvider, type InitiationResult } from "./providers";
import { MIN_DEPOSIT_FRACTION } from "./constants";

export type ActionState = { error: string | null } | null;

const initiateSchema = z.object({
  orderId: z.string().uuid(),
  methodId: z.string().min(1, "Choose a payment method."),
  payerPhone: z.string().optional(),
  // Omitted/blank = pay the full remaining balance.
  amount: z.coerce.number().positive().optional(),
});

const phonePattern = /^\+?[0-9][0-9\s-]{6,14}$/;

const PAYABLE_ORDER_STATUSES = ["pending_payment", "held", "partially_paid"] as const;

/** Sum of this order's already-succeeded payments — the source of truth for balance due. */
async function getPaidTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string
): Promise<number> {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId)
    .eq("status", "succeeded");
  return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export async function initiatePayment(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = initiateSchema.safeParse({
    orderId: formData.get("orderId"),
    methodId: formData.get("methodId"),
    payerPhone: formData.get("payerPhone")?.toString().trim() || undefined,
    amount: formData.get("amount")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const profile = await requireUser();
  const supabase = await createClient();

  // RLS scopes this read: only the customer, booker, agency member, or admin
  // can see the order at all.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, total, currency, agency_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) return { error: "We could not find this order." };
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as (typeof PAYABLE_ORDER_STATUSES)[number])) {
    return { error: "This order is not awaiting payment." };
  }

  const paidTotal = await getPaidTotal(supabase, order.id);
  const remaining = Number(order.total) - paidTotal;
  if (remaining <= 0) return { error: "This order is already fully paid." };

  // Never trust the client's amount: it must fit in the remaining balance,
  // and a *first* payment must clear the minimum-deposit floor — a balance
  // payment made after that (paidTotal > 0) can be any amount up to what's
  // left, since the floor was already satisfied.
  let amount = parsed.data.amount ?? remaining;
  amount = Math.round(amount * 100) / 100;
  if (amount > remaining + 0.01) {
    return { error: `That's more than the remaining balance of ${order.currency} ${remaining.toFixed(2)}.` };
  }
  const minFirstPayment = Math.round(Number(order.total) * MIN_DEPOSIT_FRACTION * 100) / 100;
  if (paidTotal === 0 && amount < minFirstPayment - 0.01) {
    return {
      error: `The first payment must be at least ${order.currency} ${minFirstPayment.toFixed(2)} (${MIN_DEPOSIT_FRACTION * 100}% deposit).`,
    };
  }

  if (parsed.data.methodId === "agency_wallet") {
    return payFromAgencyWallet(supabase, profile.id, order, amount);
  }

  const method = getPaymentMethod(parsed.data.methodId);
  if (!method) return { error: "That payment method is not available." };
  if (method.requiresPhone && !phonePattern.test(parsed.data.payerPhone ?? "")) {
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
      payer_phone: method.requiresPhone ? parsed.data.payerPhone : null,
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
      payerPhone: parsed.data.payerPhone,
    });
  } catch {
    result = { type: "error", message: "The payment provider did not respond. Please try again." };
  }

  // Settlement writes go through the service role: customers have no UPDATE
  // rights on payments, so state changes stay server-authoritative.
  const admin = createAdminClient();

  switch (result.type) {
    case "success": {
      await admin
        .from("payments")
        .update({ status: "succeeded", provider_ref: result.providerRef ?? null })
        .eq("id", payment.id);
      const { data: settled } = await admin
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .maybeSingle();
      redirect(settled?.status === "paid" ? `/checkout/${order.id}/success` : `/checkout/${order.id}`);
      break;
    }
    case "redirect":
      await admin
        .from("payments")
        .update({ provider_ref: result.providerRef ?? null })
        .eq("id", payment.id);
      redirect(result.url);
      break;
    case "instructions":
      await admin
        .from("payments")
        .update({
          status: "requires_action",
          instructions: result.instructions,
          provider_ref: result.providerRef ?? null,
        })
        .eq("id", payment.id);
      revalidatePath(`/checkout/${order.id}`);
      redirect(`/checkout/${order.id}`);
      break;
    case "error":
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return { error: result.message };
  }
  return null;
}

/**
 * B2B pay-from-balance: debits the agency wallet (credit limit allows going
 * negative — "book now, settle weekly") and settles the order in one step.
 * The debit itself is authorized in Postgres: apply_agency_wallet_transaction
 * re-checks membership, order ownership, and available balance atomically.
 */
async function payFromAgencyWallet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  order: { id: string; order_number: string; currency: string; agency_id: string | null },
  amount: number
): Promise<ActionState> {
  if (!order.agency_id) {
    return { error: "This order is not an agency booking." };
  }
  const agencyId = await getActiveAgencyId(supabase, profileId);
  if (agencyId !== order.agency_id) {
    return { error: "Only members of the booking agency can pay from its balance." };
  }

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

  const admin = createAdminClient();
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
  const { data: settled } = await admin.from("orders").select("status").eq("id", order.id).maybeSingle();
  redirect(settled?.status === "paid" ? `/checkout/${order.id}/success` : `/checkout/${order.id}`);
}

/** Customer abandons a pending manual payment to pick another method. */
export async function cancelPendingPayment(formData: FormData): Promise<void> {
  const paymentId = z.string().uuid().parse(formData.get("paymentId"));
  await requireUser();
  const supabase = await createClient();

  // Visibility through RLS proves the caller may act on this payment.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "requires_action") return;

  const admin = createAdminClient();
  await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
  revalidatePath(`/checkout/${payment.order_id}`);
}

/** Admin marks a manual payment (bank transfer / cash) as received. */
export async function adminConfirmPayment(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const paymentId = z.string().uuid().parse(formData.get("paymentId"));
  const admin = createAdminClient();
  await admin.from("payments").update({ status: "succeeded" }).eq("id", paymentId);
  revalidatePath("/admin/orders");
}

const recordPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  methodLabel: z.string().min(2, "Describe how the customer paid, e.g. \"Cash — office\"."),
});

export type RecordPaymentState = { error: string | null } | null;

/**
 * Admin logs a payment taken outside the online flow entirely — cash handed
 * over at the office, a bank transfer that arrived without the customer
 * going through "Pay at Office" first. Settles through the same trigger as
 * every other payment, so partial/full rollup stays correct either way.
 */
export async function adminRecordPayment(
  _prev: RecordPaymentState,
  formData: FormData
): Promise<RecordPaymentState> {
  await requirePlatformAdmin();
  const parsed = recordPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    amount: formData.get("amount"),
    methodLabel: formData.get("methodLabel"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, currency, total")
    .eq("id", parsed.data.orderId)
    .maybeSingle();
  if (!order) return { error: "We could not find this order." };

  const paidTotal = await getPaidTotal(admin, order.id);
  const remaining = Number(order.total) - paidTotal;
  if (parsed.data.amount > remaining + 0.01) {
    return { error: `That's more than the remaining balance of ${order.currency} ${remaining.toFixed(2)}.` };
  }

  const { error } = await admin.from("payments").insert({
    order_id: order.id,
    provider: "manual",
    method_label: parsed.data.methodLabel,
    amount: parsed.data.amount,
    currency: order.currency,
    status: "succeeded",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/orders");
  return { error: null };
}
