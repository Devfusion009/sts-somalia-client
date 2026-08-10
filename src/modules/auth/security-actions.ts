"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Your new password must be at least 8 characters.")
      .max(72, "Passwords are limited to 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two new passwords don't match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Your new password must be different from your current one.",
    path: ["newPassword"],
  });

/**
 * Changes the account password.
 *
 * The current password is verified by re-running signInWithPassword before the
 * update. Supabase's updateUser() does NOT require the old password, so without
 * this step anyone who found an unlocked browser could take over the account
 * outright. There is no admin-API alternative that avoids the round trip.
 */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  if (!profile.email) {
    return { error: "This account has no email address on file — contact support to reset it." };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { error: "That current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { error: error.message };

  revalidatePath("/account/security");
  return { error: null };
}

/**
 * Ends every session on every device, including this one.
 *
 * scope: "global" revokes all refresh tokens server-side — the point of the
 * button is that a session on a lost phone actually dies, which a local sign-out
 * would not achieve.
 */
export async function signOutEverywhereAction(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

/** Records a sign-in for the login-history list. Best-effort; never blocks login. */
export async function recordLoginEvent(profileId: string, portal?: string): Promise<void> {
  try {
    const supabase = await createClient();
    const headerList = await headers();

    // x-forwarded-for is a comma-separated chain; the first entry is the
    // client. Behind a proxy that doesn't set it, this is simply null — an
    // unknown IP is better than recording the load balancer's.
    const forwarded = headerList.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;

    await supabase.from("login_events").insert({
      profile_id: profileId,
      portal: portal ?? null,
      ip_address: ip,
      user_agent: headerList.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch {
    // A failed audit write must never stop someone signing in.
  }
}

const deletionSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(1000, "Please keep this under 1000 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  confirm: z.literal("DELETE", {
    message: 'Type DELETE exactly to confirm.',
  }),
});

/**
 * Opens an account deletion request.
 *
 * Deliberately a request, not a deletion. Bookings, invoices and payment
 * records carry statutory retention obligations, and a customer with a live
 * Umrah booking cannot have their identity removed mid-trip. Staff close the
 * loop once obligations allow.
 */
export async function requestAccountDeletionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = deletionSchema.safeParse({
    reason: formData.get("reason") ?? undefined,
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("account_deletion_requests").insert({
    profile_id: profile.id,
    reason: parsed.data.reason,
  });

  if (error) {
    // The partial unique index guarantees one open request per profile.
    if (error.code === "23505") {
      return { error: "You already have a deletion request open. We'll be in touch about it." };
    }
    return { error: error.message };
  }

  revalidatePath("/account/security");
  return { error: null };
}

export async function withdrawDeletionRequestAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const requestId = z.string().uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return;

  const supabase = await createClient();
  await supabase
    .from("account_deletion_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId.data)
    .eq("profile_id", profile.id)
    .in("status", ["requested", "in_review"]);

  revalidatePath("/account/security");
}
