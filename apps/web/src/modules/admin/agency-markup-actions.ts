"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  agencyId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Applies (or declines) one pending agency markup request via the
 * review_agency_markup_request RPC, which swaps the live rule, notifies the
 * requester, and logs a partner_account_events row in one transaction.
 */
export async function reviewMarkupRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    agencyId: formData.get("agencyId"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.decision === "rejected" && !parsed.data.note) {
    return { error: "Add a note for the agency." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_agency_markup_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  revalidatePath("/admin/agencies");
  return { error: null };
}
