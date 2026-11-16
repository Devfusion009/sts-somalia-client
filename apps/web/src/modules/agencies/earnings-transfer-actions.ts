"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "./queries";

type TransferState = { error: string | null; message?: string };

export async function transferAgencyEarnings(_prev: TransferState, formData: FormData): Promise<TransferState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !["owner", "admin"].includes(membership.roleInAgency)) {
    return { error: "Only the agency owner or an admin can transfer earnings." };
  }
  const parsed = z.object({ amount: z.coerce.number().positive().multipleOf(0.01), transferId: z.string().uuid() })
    .safeParse({ amount: formData.get("amount"), transferId: formData.get("transferId") });
  if (!parsed.success) return { error: "Enter a valid transfer amount." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_agency_earnings_to_wallet", {
    p_agency_id: membership.agency.id, p_amount: parsed.data.amount, p_transfer_id: parsed.data.transferId,
  });
  if (error) return { error: error.message };
  for (const path of ["/agent", "/agent/finance", "/agent/finance/transactions", "/agent/finance/withdrawals", "/agent/reports", `/admin/agencies/${membership.agency.id}`]) {
    revalidatePath(path);
  }
  return { error: null, message: "Earnings transferred to wallet." };
}
