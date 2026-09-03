"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { isPayoutMethod } from "@/modules/payments/payout";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function revalidatePayout(agencyId: string) {
  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath("/admin/agencies");
  revalidatePath("/admin/finance/withdrawals");
}

/** A date input gives a bare day; the column wants an instant. */
function toTimestamp(day: string | undefined): string | undefined {
  if (!day) return undefined;
  const parsed = new Date(day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Filed under the agency's own folder rather than the admin's, because the
 * payment-proofs policy grants read by agency membership — that path is what
 * lets the agent open the slip for their own payout.
 */
async function uploadPayoutProof(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  agencyId: string
): Promise<{ path: string | null } | { error: string }> {
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) return { path: null };
  if (proof.size > MAX_PROOF_BYTES) return { error: "That file is larger than 5 MB." };
  if (!PROOF_TYPES.includes(proof.type)) return { error: "Upload a JPG, PNG, WebP, or PDF." };

  const path = `${agencyId}/payout-${Date.now()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80)}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(path, proof, {
    contentType: proof.type,
  });
  if (error) return { error: error.message };
  return { path };
}

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

// ----------------------------------------------------------------------------
// Earnings review + payout requests (20260902000001).
// ----------------------------------------------------------------------------

/**
 * Approving is what turns a commission entry into money the agent can
 * withdraw, so the console posts the exact entry ids the admin ticked
 * rather than a blanket "approve everything pending".
 */
export async function reviewAgencyCommissionEntries(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      entryIds: z.array(z.string().uuid()).min(1, "Select at least one entry."),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      decision: formData.get("decision"),
      entryIds: formData.getAll("entryIds"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_agency_commission_entries", {
    p_entry_ids: parsed.data.entryIds,
    p_decision: parsed.data.decision,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  revalidatePath("/admin/agencies");
  return { error: null };
}

export async function reviewAgencyPayoutRequest(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      requestId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(500).optional(),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      requestId: formData.get("requestId"),
      decision: formData.get("decision"),
      note: formData.get("note") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_agency_payout_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message };

  revalidatePayout(parsed.data.agencyId);
  return { error: null };
}

/**
 * Records a transfer that has left but hasn't landed. The offline rail's
 * real middle state: an admin has been to the bank, and the agent needs to
 * see that before the money shows up in their account a day or three later.
 */
export async function markAgencyPayoutSent(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      requestId: z.string().uuid(),
      method: z.string().refine(isPayoutMethod, "Choose how the transfer was sent."),
      reference: z.string().trim().max(200).optional(),
      sentAt: z.string().optional(),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      requestId: formData.get("requestId"),
      method: formData.get("method"),
      reference: formData.get("reference")?.toString().trim() || undefined,
      sentAt: formData.get("sentAt")?.toString() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const proof = await uploadPayoutProof(supabase, formData, parsed.data.agencyId);
  if ("error" in proof) return { error: proof.error };

  const { error } = await supabase.rpc("mark_agency_payout_sent", {
    p_request_id: parsed.data.requestId,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
    p_proof_path: proof.path ?? undefined,
    p_sent_at: toTimestamp(parsed.data.sentAt),
  });
  if (error) {
    if (proof.path) await supabase.storage.from("payment-proofs").remove([proof.path]);
    return { error: error.message };
  }

  revalidatePayout(parsed.data.agencyId);
  return { error: null };
}

/**
 * Records the transfer that was actually sent. settle_agency_payout_request
 * writes the payout row and marks the matching commission entries paid_out
 * in the same transaction, so the ledger can never say "available" for
 * money that has already left.
 */
export async function settleAgencyPayoutRequest(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      requestId: z.string().uuid(),
      method: z.string().max(100).optional(),
      reference: z.string().max(200).optional(),
      paidAt: z.string().optional(),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      requestId: formData.get("requestId"),
      method: formData.get("method") || undefined,
      reference: formData.get("reference") || undefined,
      paidAt: formData.get("paidAt")?.toString() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const proof = await uploadPayoutProof(supabase, formData, parsed.data.agencyId);
  if ("error" in proof) return { error: proof.error };

  const { error } = await supabase.rpc("settle_agency_payout_request", {
    p_request_id: parsed.data.requestId,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
    p_proof_path: proof.path ?? undefined,
    p_paid_at: toTimestamp(parsed.data.paidAt),
  });
  if (error) {
    if (proof.path) await supabase.storage.from("payment-proofs").remove([proof.path]);
    return { error: error.message };
  }

  revalidatePayout(parsed.data.agencyId);
  return { error: null };
}

/**
 * A sent transfer that bounced. fail_agency_payout_request leaves the
 * commission entries confirmed, so the amount returns to the agency's
 * available balance and they can correct their bank details and ask again.
 */
export async function failAgencyPayoutRequest(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      requestId: z.string().uuid(),
      reason: z.string().trim().min(1, "Say what went wrong.").max(500),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      requestId: formData.get("requestId"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fail_agency_payout_request", {
    p_request_id: parsed.data.requestId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: error.message };

  revalidatePayout(parsed.data.agencyId);
  return { error: null };
}

/**
 * Confirms (or declines) money an agency says it sent offline. Approving is
 * the only thing that credits the wallet — review_agency_topup writes the
 * deposit and links the ledger row to this request in one transaction.
 */
export async function reviewAgencyTopup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = z
    .object({
      agencyId: z.string().uuid(),
      requestId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(500).optional(),
    })
    .safeParse({
      agencyId: formData.get("agencyId"),
      requestId: formData.get("requestId"),
      decision: formData.get("decision"),
      note: formData.get("note") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_agency_topup", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  revalidatePath("/admin/agencies");
  return { error: null };
}
