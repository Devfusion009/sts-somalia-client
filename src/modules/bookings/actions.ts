"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const requestSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(["cancellation", "refund", "modification"]),
  reason: z
    .string()
    .trim()
    .min(10, "Tell us briefly what you need — at least a sentence helps us act on it faster.")
    .max(2000, "Please keep this under 2000 characters."),
  requestedAmount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter a valid amount."),
});

/**
 * Opens a cancellation, refund, or change request against a paid order.
 *
 * Deliberately does NOT mutate the order. Once money has moved, whether a
 * booking can be cancelled and what it costs is governed by the supplier's fare
 * rules, not by this form — so the customer's job is to ask, and staff resolve
 * it from the admin portal. cancel_order() still handles the pre-payment case
 * directly, which is why this path is only offered for orders past that point.
 */
export async function openBookingRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = requestSchema.safeParse({
    orderId: formData.get("orderId"),
    kind: formData.get("kind"),
    reason: formData.get("reason"),
    requestedAmount: formData.get("requestedAmount") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Read the order through RLS first: this both authorises the request and
  // gives us the currency, so a client-supplied currency can't be smuggled in.
  const { data: order } = await supabase
    .from("orders")
    .select("id, currency, status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) return { error: "That order could not be found." };

  // One open request per kind per order — a second identical request just
  // splits the conversation across two queue entries.
  const { data: existing } = await supabase
    .from("booking_requests")
    .select("id")
    .eq("order_id", order.id)
    .eq("kind", parsed.data.kind)
    .in("status", ["requested", "in_review"])
    .maybeSingle();

  if (existing) {
    return { error: "You already have an open request of this type for this booking." };
  }

  const { error } = await supabase.from("booking_requests").insert({
    order_id: order.id,
    requested_by: profile.id,
    kind: parsed.data.kind,
    reason: parsed.data.reason,
    requested_amount: parsed.data.requestedAmount,
    currency: order.currency,
  });

  if (error) return { error: error.message };

  revalidatePath(`/account/bookings/${order.id}`);
  revalidatePath("/account/bookings");
  revalidatePath("/account/payments");
  return { error: null };
}

/** Withdraws a request the customer raised, while it is still open. */
export async function withdrawBookingRequestAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const parsed = z
    .object({ requestId: z.string().uuid(), orderId: z.string().uuid() })
    .safeParse({
      requestId: formData.get("requestId"),
      orderId: formData.get("orderId"),
    });
  if (!parsed.success) return;

  const supabase = await createClient();
  // The status predicate mirrors the RLS policy's USING clause so a request
  // already resolved by staff can't be flipped back to withdrawn.
  await supabase
    .from("booking_requests")
    .update({ status: "withdrawn" })
    .eq("id", parsed.data.requestId)
    .eq("requested_by", profile.id)
    .in("status", ["requested", "in_review"]);

  revalidatePath(`/account/bookings/${parsed.data.orderId}`);
  revalidatePath("/account/payments");
}
