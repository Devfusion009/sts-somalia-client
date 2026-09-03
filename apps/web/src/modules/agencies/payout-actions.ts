"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

const PAYOUT_MANAGERS = new Set(["owner", "admin"]);

const requestSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
});

/**
 * Files a withdrawal request against the agency's available earnings. Every
 * rule that decides whether the amount is actually withdrawable (bank
 * details on file, amount within available, requests already in flight)
 * lives in request_agency_payout so the ledger can't be raced from two
 * tabs; this only maps the RPC's error back to the form.
 */
export async function requestAgencyPayout(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (!PAYOUT_MANAGERS.has(membership.roleInAgency)) {
    return { error: "Only the agency owner or an admin can request a payout." };
  }

  const parsed = requestSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_agency_payout", {
    p_agency_id: membership.agency.id,
    p_amount: Math.round(parsed.data.amount * 100) / 100,
  });
  if (error) return { error: error.message };

  revalidatePath("/agent/finance/withdrawals");
  revalidatePath("/agent/finance");
  return { error: null };
}

export async function cancelAgencyPayoutRequest(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !PAYOUT_MANAGERS.has(membership.roleInAgency)) return;

  const requestId = z.string().uuid().parse(formData.get("requestId"));
  const supabase = await createClient();
  await supabase
    .from("agency_payout_requests")
    .delete()
    .eq("id", requestId)
    .eq("agency_id", membership.agency.id)
    .eq("status", "pending");

  revalidatePath("/agent/finance/withdrawals");
  revalidatePath("/agent/finance");
}
