"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const rateSchema = z.object({
  agencyId: z.string().uuid(),
  commissionRate: z.coerce.number().min(0).max(100),
});

export async function updateAgencyCommissionRate(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = rateSchema.safeParse({
    agencyId: formData.get("agencyId"),
    commissionRate: formData.get("commissionRate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ commission_rate: parsed.data.commissionRate, commission_rate_set_at: new Date().toISOString() })
    .eq("id", parsed.data.agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

const creditSchema = z.object({
  agencyId: z.string().uuid(),
  creditLimit: z.coerce.number().min(0).max(10_000_000),
});

export async function updateAgencyCreditLimit(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = creditSchema.safeParse({
    agencyId: formData.get("agencyId"),
    creditLimit: formData.get("creditLimit"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ credit_limit: parsed.data.creditLimit })
    .eq("id", parsed.data.agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

const payoutSchema = z.object({
  agencyId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

/**
 * Records a commission payout already sent outside the system (e.g. a bank
 * transfer) and marks matching confirmed commission entries as paid_out —
 * atomically, via record_agency_commission_payout. The RPC checks
 * is_admin() itself, so the admin's normal RLS-scoped client is enough.
 */
export async function recordAgencyCommissionPayout(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = payoutSchema.safeParse({
    agencyId: formData.get("agencyId"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    reference: formData.get("reference") || undefined,
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_agency_commission_payout", {
    target_agency_id: parsed.data.agencyId,
    payout_amount: parsed.data.amount,
    payout_method: parsed.data.method,
    payout_ref: parsed.data.reference,
    target_period_start: parsed.data.periodStart,
    target_period_end: parsed.data.periodEnd,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

const walletSchema = z.object({
  agencyId: z.string().uuid(),
  amount: z.coerce
    .number()
    .refine((v) => v !== 0, "Amount can't be zero.")
    .refine((v) => Math.abs(v) <= 1_000_000, "Amount is too large."),
  note: z.string().max(500).optional(),
});

/**
 * Admin credits (deposit) or corrects (adjustment) an agency wallet. Goes
 * through the same apply_agency_wallet_transaction function as agent
 * spending, so the balance and ledger can never diverge. Uses the admin's
 * RLS client — the SQL function authorizes via is_admin() itself.
 */
export async function adminApplyWalletTransaction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = walletSchema.safeParse({
    agencyId: formData.get("agencyId"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_agency_wallet_transaction", {
    target_agency_id: parsed.data.agencyId,
    tx_amount: parsed.data.amount,
    tx_type: parsed.data.amount > 0 ? "deposit" : "adjustment",
    tx_note: parsed.data.note,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

const noteSchema = z.object({
  agencyId: z.string().uuid(),
  kind: z.enum(["credit_note", "debit_note"]),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  reason: z.string().trim().min(3, "Give a short reason."),
});

/**
 * Admin issues a formal credit or debit note — a distinct, numbered wallet
 * transaction (CN-.../DN-... via the document_number trigger), not just an
 * undifferentiated 'adjustment'. Credit notes credit the wallet (positive);
 * debit notes charge it (the entered amount is negated server-side so the
 * admin always enters a plain positive magnitude).
 */
export async function issueAgencyNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = noteSchema.safeParse({
    agencyId: formData.get("agencyId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_agency_wallet_transaction", {
    target_agency_id: parsed.data.agencyId,
    tx_amount: parsed.data.kind === "credit_note" ? parsed.data.amount : -parsed.data.amount,
    tx_type: parsed.data.kind,
    tx_note: parsed.data.reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

const reviewRefundSchema = z.object({
  requestId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
});

/** Admin approves a refund request — credits the wallet via apply_agency_wallet_transaction and links the resulting ledger row. The RPC checks is_admin() and 'pending' status itself. */
export async function approveRefundRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = reviewRefundSchema.safeParse({
    requestId: formData.get("requestId"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_agency_refund_request", {
    request_id: parsed.data.requestId,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/refunds");
  return { error: null };
}

export async function rejectRefundRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = reviewRefundSchema.safeParse({
    requestId: formData.get("requestId"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_agency_refund_request", {
    request_id: parsed.data.requestId,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/refunds");
  return { error: null };
}

const ITEM_TYPES = ["flight", "hotel", "visa", "umrah", "hall"] as const;

const allowedProductsSchema = z.object({
  agencyId: z.string().uuid(),
  products: z.array(z.enum(ITEM_TYPES)),
});

/** Empty products array = unrestricted (agency can book every vertical). */
export async function updateAgencyAllowedProducts(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = allowedProductsSchema.safeParse({
    agencyId: formData.get("agencyId"),
    products: formData.getAll("products"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ allowed_products: parsed.data.products })
    .eq("id", parsed.data.agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}
