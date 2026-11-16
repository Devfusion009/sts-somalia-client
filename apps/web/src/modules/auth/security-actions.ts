"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { checkPasswordRules, isPasswordBreached } from "@/lib/auth/password-policy";
import { recordSecurityEvent } from "@/lib/auth/login-history";
import { countUnusedRecoveryCodes, deleteRecoveryCodes, generateRecoveryCodes } from "@/lib/auth/recovery-codes";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(1, "Enter a new password."),
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

/** The signed-in session's id (`session_id` claim). */
async function currentSessionId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.session_id;
  return typeof id === "string" ? id : null;
}

/**
 * Checks the current password on a throwaway client, so the visitor's own
 * session (and its two-factor level) is left untouched, then signs that
 * throwaway session straight out again.
 */
async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await probe.auth.signOut({ scope: "local" }).catch(() => null);
  return true;
}

/**
 * Changes the account password: confirms the current one, enforces the
 * password rules (length, no name or email, not in a known breach), updates
 * it, optionally signs every other device out, and notifies the owner.
 */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
  const { currentPassword, newPassword } = parsed.data;

  const ruleError = checkPasswordRules(newPassword, { email: profile.email, fullName: profile.full_name });
  if (ruleError) return { error: ruleError };

  if (!(await verifyCurrentPassword(profile.email, currentPassword))) {
    return { error: "That current password is incorrect." };
  }

  if ((await isPasswordBreached(newPassword)) === true) {
    return { error: "This password has appeared in a data breach. Choose a different one." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.code === "reauthentication_needed") return { error: "Sign in again, then change your password." };
    if (error.code === "same_password") return { error: "Your new password must be different from your current one." };
    if (error.code === "weak_password") return { error: "Choose a longer, less common password." };
    return { error: error.message };
  }

  const sessionId = await currentSessionId(supabase);
  if (formData.get("signOutOthers") === "on") {
    await supabase.auth.signOut({ scope: "others" });
  }
  await recordSecurityEvent(profile.id, "password_changed", { email: profile.email, sessionId });

  revalidatePath("/account/security");
  return { error: null };
}

/** Signs every other device out; this one stays signed in. */
export async function signOutOtherDevicesAction(): Promise<ActionState> {
  const profile = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: "Could not sign out other devices." };
  await recordSecurityEvent(profile.id, "signed_out_others", { sessionId: await currentSessionId(supabase) });
  revalidatePath("/account/security");
  return { error: null };
}

/** Signs out one other device from the "Where you're signed in" list. */
export async function revokeSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const target = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!target.success) return { error: "Session not found." };

  const supabase = await createClient();
  const current = await currentSessionId(supabase);
  if (target.data === current) return { error: "Use Sign out for this device." };

  const { data, error } = await supabase.rpc("revoke_my_session", { p_session_id: target.data });
  if (error || !data) return { error: "Could not sign out that device." };
  await recordSecurityEvent(profile.id, "session_revoked", { sessionId: current });
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

export type RecoveryCodesState = { error: string | null; codes?: string[] } | null;

/** True when this session has passed two-factor verification. */
async function sessionAtAal2(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

/**
 * Runs after the browser verifies a new authenticator. The first one turns
 * two-factor on: the owner is notified and gets a set of recovery codes.
 */
export async function completeMfaEnrollmentAction(): Promise<RecoveryCodesState> {
  const profile = await requireUser();
  const supabase = await createClient();
  if (!(await sessionAtAal2(supabase))) return { error: "Verify your authenticator first." };

  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp.filter((f) => f.status === "verified") ?? [];
  const firstFactor = verified.length === 1;

  if (firstFactor) {
    await recordSecurityEvent(profile.id, "mfa_enabled", {
      email: profile.email,
      sessionId: await currentSessionId(supabase),
    });
  }
  revalidatePath("/account/security");
  try {
    const hasCodes = (await countUnusedRecoveryCodes(profile.id)) > 0;
    if (firstFactor || !hasCodes) {
      return { error: null, codes: await generateRecoveryCodes(profile.id) };
    }
  } catch {
    return { error: "Two-factor is enabled. Recovery codes are unavailable." };
  }
  return { error: null };
}

/** New recovery codes; the previous set stops working. */
export async function regenerateRecoveryCodesAction(): Promise<RecoveryCodesState> {
  const profile = await requireUser();
  const supabase = await createClient();
  if (!(await sessionAtAal2(supabase))) return { error: "Verify your authenticator first." };

  const { data } = await supabase.auth.mfa.listFactors();
  if (!data?.totp.some((f) => f.status === "verified")) return { error: "Turn on two-factor authentication first." };

  try {
    const codes = await generateRecoveryCodes(profile.id);
    await recordSecurityEvent(profile.id, "recovery_codes_generated", { sessionId: await currentSessionId(supabase) });
    revalidatePath("/account/security");
    return { error: null, codes };
  } catch {
    return { error: "Could not create recovery codes." };
  }
}

/** Runs after the browser removes an authenticator: the last one turns two-factor off. */
export async function afterMfaFactorRemovedAction(): Promise<void> {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  if (!data?.totp.some((f) => f.status === "verified")) {
    await deleteRecoveryCodes(profile.id);
    await recordSecurityEvent(profile.id, "mfa_disabled", {
      email: profile.email,
      sessionId: await currentSessionId(supabase),
    });
  }
  revalidatePath("/account/security");
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
      return { error: "A deletion request is already open." };
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
