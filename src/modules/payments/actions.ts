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

export type ActionState = { error: string | null } | null;

const initiateSchema = z.object({
  orderId: z.string().uuid(),
  methodId: z.string().min(1, "Choose a payment method."),
  payerPhone: z.string().optional(),
});

const phonePattern = /^\+?[0-9][0-9\s-]{6,14}$/;

export async function initiatePayment(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = initiateSchema.safeParse({
    orderId: formData.get("orderId"),
    methodId: formData.get("methodId"),
    payerPhone: formData.get("payerPhone")?.toString().trim() || undefined,
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
  if (order.status !== "pending_payment") {
    return { error: "This order is not awaiting payment." };
  }

  if (parsed.data.methodId === "agency_wallet") {
    return payFromAgencyWallet(supabase, profile.id, order);
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
      amount: order.total,
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
      amount: Number(order.total),
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
    case "success":
      await admin
        .from("payments")
        .update({ status: "succeeded", provider_ref: result.providerRef ?? null })
        .eq("id", payment.id);
      redirect(`/checkout/${order.id}/success`);
      break;
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
  order: { id: string; order_number: string; total: number; currency: string; agency_id: string | null }
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
      amount: order.total,
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
    tx_amount: -Number(order.total),
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
  redirect(`/checkout/${order.id}/success`);
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
