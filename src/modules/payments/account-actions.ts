"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { SAVABLE_WALLETS } from "./saved-methods";

const walletIds = SAVABLE_WALLETS.map((w) => w.id) as [string, ...string[]];

const savedMethodSchema = z.object({
  provider: z.enum(walletIds),
  // Digits, spaces, dashes and an optional leading +. Deliberately permissive
  // about formatting and strict about length: Somali wallet numbers are dialled
  // in several local formats and rejecting a valid one is worse than storing a
  // number with a space in it.
  msisdn: z
    .string()
    .trim()
    .min(7, "Enter the full wallet number.")
    .max(20, "That number is too long.")
    .regex(/^\+?[\d\s-]+$/, "Use digits only, with optional spaces or dashes."),
  label: z
    .string()
    .trim()
    .max(60, "Keep the nickname under 60 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  makeDefault: z.boolean(),
});

/**
 * Saves a mobile-money number for reuse at checkout.
 *
 * Nothing here can move money. These rows are a convenience store of the
 * customer's own wallet numbers so checkout can prefill the phone field — the
 * payment itself still goes through the gateway's own authorisation, where the
 * customer approves the debit on their handset.
 */
export async function saveWalletMethodAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = savedMethodSchema.safeParse({
    provider: formData.get("provider"),
    msisdn: formData.get("msisdn"),
    label: formData.get("label") ?? undefined,
    makeDefault: formData.get("makeDefault") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const methodId = formData.get("methodId")?.toString().trim() || null;

  // Clearing the previous default BEFORE writing this one keeps the
  // payment_methods_one_default_per_customer partial unique index satisfied.
  // The reverse order trips the constraint mid-statement.
  if (parsed.data.makeDefault) {
    await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("customer_id", profile.id)
      .eq("is_default", true);
  }

  const row = {
    provider: parsed.data.provider,
    kind: "mobile_money" as const,
    msisdn: parsed.data.msisdn,
    label: parsed.data.label,
    is_default: parsed.data.makeDefault,
  };

  if (methodId) {
    const { error } = await supabase
      .from("payment_methods")
      .update(row)
      .eq("id", methodId)
      .eq("customer_id", profile.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("payment_methods")
      .insert({ customer_id: profile.id, ...row });
    if (error) return { error: error.message };
  }

  revalidatePath("/account/payments");
  return { error: null };
}

export async function deleteWalletMethodAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const methodId = z.string().uuid().safeParse(formData.get("methodId"));
  if (!methodId.success) return;

  const supabase = await createClient();
  await supabase
    .from("payment_methods")
    .delete()
    .eq("id", methodId.data)
    .eq("customer_id", profile.id);

  revalidatePath("/account/payments");
}

/** Promotes one saved method to default, demoting whichever held it before. */
export async function setDefaultWalletMethodAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const methodId = z.string().uuid().safeParse(formData.get("methodId"));
  if (!methodId.success) return;

  const supabase = await createClient();

  await supabase
    .from("payment_methods")
    .update({ is_default: false })
    .eq("customer_id", profile.id)
    .eq("is_default", true);

  await supabase
    .from("payment_methods")
    .update({ is_default: true })
    .eq("id", methodId.data)
    .eq("customer_id", profile.id);

  revalidatePath("/account/payments");
}
