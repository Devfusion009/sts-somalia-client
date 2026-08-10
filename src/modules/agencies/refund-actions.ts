"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

const requestSchema = z.object({
  orderId: z.string().uuid().optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)."),
});

/**
 * Booker role (owner/admin/booking_staff) requests a refund against their
 * agency's order. RLS ("agency_refund_requests: booker submits") is the
 * real authorization boundary, including the order-belongs-to-agency check
 * — this just gives a clearer error than a bare RLS denial. Starts
 * 'pending'; only an admin can move it via approve/reject_agency_refund_
 * request (see 20260809000002_agency_account_center.sql).
 */
export async function requestAgencyRefundAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (!["owner", "admin", "booking_staff"].includes(membership.roleInAgency)) {
    return { error: "Only the owner, an admin, or booking staff can request a refund." };
  }

  const parsed = requestSchema.safeParse({
    orderId: formData.get("orderId") || undefined,
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_refund_requests").insert({
    agency_id: membership.agency.id,
    order_id: parsed.data.orderId || null,
    requested_by: profile.id,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/agent/refunds");
  return { error: null };
}
