"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const payoutSchema = z.object({
  // Two different ids, deliberately both required — affiliateId is
  // affiliates.id (what the RPC/commission_payouts actually key on);
  // accountId is partner_accounts.id (what the console URL is keyed on,
  // for revalidatePath). The partner console page already has both in
  // scope when rendering (account.id and account.entity_id — see the
  // agency finance-console link on the same page for the same pattern),
  // so the form just carries both rather than this action re-deriving
  // one from the other.
  affiliateId: z.string().uuid(),
  accountId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

/**
 * Records a commission payout already sent outside the system (e.g. a bank
 * transfer or EVC Plus) and marks matching approved conversions in this
 * affiliate as paid — atomically, via record_affiliate_commission_payout.
 * Direct clone of recordAgencyCommissionPayout — the RPC checks is_admin()
 * itself, so the admin's normal RLS-scoped client is enough.
 */
export async function recordAffiliateCommissionPayout(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = payoutSchema.safeParse({
    affiliateId: formData.get("affiliateId"),
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    reference: formData.get("reference") || undefined,
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_affiliate_commission_payout", {
    target_affiliate_id: parsed.data.affiliateId,
    payout_amount: parsed.data.amount,
    payout_method: parsed.data.method,
    payout_ref: parsed.data.reference,
    target_period_start: parsed.data.periodStart,
    target_period_end: parsed.data.periodEnd,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/partners/affiliate/${parsed.data.accountId}`);
  return { error: null };
}
