"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Agent decides to pay now for a held booking — flips it into normal
 * checkout. Errors are swallowed deliberately (matches cancelPendingPayment):
 * the checkout page re-derives its view from the order's true status either
 * way, so a failed conversion just leaves the hold banner showing.
 */
export async function convertHoldToCheckout(formData: FormData): Promise<void> {
  await requireUser();
  const orderId = z.string().uuid().parse(formData.get("orderId"));
  const supabase = await createClient();

  await supabase.rpc("convert_hold_to_checkout", { target_order_id: orderId });
  redirect(`/checkout/${orderId}`);
}

/** Cancels a held or unpaid order — cascades to the booking and releases any reserved inventory. */
export async function cancelOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const orderId = z.string().uuid().parse(formData.get("orderId"));
  const reason = formData.get("reason")?.toString().trim() || undefined;
  const redirectTo = formData.get("redirectTo")?.toString();

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { target_order_id: orderId, reason });
  if (error) return { error: error.message };

  if (redirectTo) {
    revalidatePath(redirectTo);
    redirect(redirectTo);
  }
  return { error: null };
}
