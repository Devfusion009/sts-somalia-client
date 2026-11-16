"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { money } from "@/lib/money";
import { getMyAgency } from "./queries";

const requestSchema = z.object({
  orderId: z.string().uuid("Choose the order to refund."),
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
    orderId: formData.get("orderId") ?? "",
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Same cap the admin approval enforces: what this order took from the
  // wallet, less refunds already credited and requests still pending.
  const [{ data: ledger }, { data: open }] = await Promise.all([
    supabase
      .from("agency_wallet_transactions")
      .select("type, amount")
      .eq("agency_id", membership.agency.id)
      .eq("order_id", parsed.data.orderId),
    supabase
      .from("agency_refund_requests")
      .select("amount")
      .eq("agency_id", membership.agency.id)
      .eq("order_id", parsed.data.orderId)
      .eq("status", "pending"),
  ]);
  const paid = (ledger ?? []).reduce(
    (sum, tx) => (tx.type === "booking_payment" || tx.type === "refund" ? sum - Number(tx.amount) : sum),
    0
  );
  const requested = (open ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = Math.round((paid - requested) * 100) / 100;
  if (refundable <= 0) return { error: "Nothing left to refund on this order." };
  if (parsed.data.amount > refundable) {
    return { error: `The most you can request for this order is ${money(refundable, "USD")}.` };
  }

  const { error } = await supabase.from("agency_refund_requests").insert({
    agency_id: membership.agency.id,
    order_id: parsed.data.orderId,
    requested_by: profile.id,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/agent/refunds");
  return { error: null };
}
