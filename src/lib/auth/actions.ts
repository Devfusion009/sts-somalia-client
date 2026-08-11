"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { portalForProfile } from "@/lib/auth/roles";
import { portalHref, portalLoginHref, rootOrigin } from "@/lib/subdomain";
import { recordLoginEvent } from "@/modules/auth/security-actions";

export type ActionState = { error: string | null } | null;

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function signInAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Resolve the landing portal from the account's actual role server-side —
  // this is the default now, not an afterthought. redirect_to still wins
  // when present (deep-linking, e.g. "log in to view this booking"), but an
  // agent or admin signing in with no redirect_to param must land in their
  // own portal, not fall through to /account.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A plain customer belongs on the marketing site, not in the account shell:
  // they log in to browse and book, and dropping them on a profile form with
  // four zeroed stat cards reads as a dead end. Staff and partners still land
  // in their own portal via portalForProfile below, and redirect_to always
  // wins when present.
  let roleDestination = "/";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_platform_admin")
      .eq("id", user.id)
      .single();
    // Recorded before the rejection below, so an admin credential used on the
    // CUSTOMER form still appears in login history — that is precisely the
    // event worth being able to see afterwards. Awaited but internally
    // swallowed: it can slow login slightly, never break it.
    await recordLoginEvent(user.id, profile?.role ?? undefined);

    // The customer sign-in box is NOT an entry point to the platform console.
    //
    // Without a custom domain both portals sit on one origin and therefore
    // share one cookie, so the host-only cookie scoping that isolates them
    // (see cookieDomain) has nothing to separate — and portalForProfile()
    // hands an admin a same-origin "/admin", dropping them straight into the
    // console from the public form. Refusing here is the strongest boundary
    // available in path-based mode, and it mirrors signInToPortalAction, which
    // already turns non-admins away from /admin/login.
    //
    // Sign back out first: leaving a valid admin session attached to a
    // "rejected" sign-in would defeat the entire point.
    if (profile?.is_platform_admin) {
      await supabase.auth.signOut();
      return {
        error: `This is a staff account — it can't be used on the customer sign-in. Use the Admin Console sign-in at ${portalLoginHref("admin")}.`,
      };
    }

    if (profile) {
      const portal = portalForProfile(profile);
      // Only follow SAME-ORIGIN portal destinations. When subdomains are
      // configured, sessions are host-only, so sending an agent from the
      // customer login straight to agent.<host> would land them on that
      // portal's sign-in page immediately after signing in — they have to
      // authenticate on that origin. /partner and /affiliate are paths on this
      // same host and still work, so those are followed as before.
      const crossOrigin = portal?.href.startsWith("http") ?? false;
      roleDestination = portal && !crossOrigin ? portal.href : "/";
    }
  }

  const redirectTo = formData.get("redirect_to");
  const finalDestination = typeof redirectTo === "string" && redirectTo ? redirectTo : roleDestination;

  // Password verified but a verified TOTP factor is on file — the session
  // is only at aal1 until the challenge is completed.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    redirect(`/login/verify-2fa?redirect_to=${encodeURIComponent(finalDestination)}`);
  }

  redirect(finalDestination);
}

type PortalKind = "agent" | "admin";

const PORTAL_LOGIN_META: Record<PortalKind, { audienceError: string }> = {
  agent: { audienceError: "This account doesn't have agent access." },
  admin: { audienceError: "This account doesn't have admin access." },
};

/**
 * Subdomain-aware portal destination (absolute cross-origin URL once
 * NEXT_PUBLIC_APP_HOST is set, relative path otherwise) — same fallback
 * shape as portalForProfile() in lib/auth/roles.ts. A hardcoded relative
 * "/agent" would 404 on the root host once proxy.ts's subdomain block is
 * active (see docs/B2B-PORTAL-SEPARATION-BUILD-PROMPT.md).
 *
 * This action is only ever submitted FROM the portal's own origin now (the
 * dedicated /agent/login and /admin/login pages). It must stay that way:
 * sessions are host-only, so credentials posted from the public host write
 * the cookie there and the portal redirected to cannot read it. See the note
 * on portalLoginHref in lib/subdomain.ts.
 */
function portalDestination(portal: PortalKind): string {
  return portalHref(portal);
}

async function hasActiveAgencyMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

/**
 * Shared sign-in logic for the dedicated /agent/login and /admin/login
 * routes. Unlike the plain /login form, this validates the authenticated
 * account actually holds the matching audience BEFORE establishing a
 * "successful login" state for that portal — a customer submitting
 * /admin/login sees a clear "doesn't have admin access" error instead of
 * landing on a broken or empty dashboard. is_platform_admin (not
 * role='admin') is the admin check, for the same reason requirePlatformAdmin
 * uses it — see session.ts.
 */
async function signInToPortalAction(
  portal: PortalKind,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Incorrect email or password." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  const holdsAudience =
    portal === "admin"
      ? !!profile?.is_platform_admin
      : await hasActiveAgencyMembership(supabase, user.id);

  if (!holdsAudience) {
    // Leaving a valid session sitting on the wrong portal's login page reads
    // as a silent failure — sign back out before surfacing the error so the
    // account isn't left half-authenticated into a portal it can't use.
    await supabase.auth.signOut();
    return { error: PORTAL_LOGIN_META[portal].audienceError };
  }

  const redirectTo = formData.get("redirect_to");
  const finalDestination =
    typeof redirectTo === "string" && redirectTo ? redirectTo : portalDestination(portal);

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    redirect(`/login/verify-2fa?redirect_to=${encodeURIComponent(finalDestination)}`);
  }

  redirect(finalDestination);
}

export const signInToAgentPortalAction = signInToPortalAction.bind(null, "agent");
export const signInToAdminPortalAction = signInToPortalAction.bind(null, "admin");

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().min(2, "Enter your full name."),
});

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    return { error: error.message };
  }

  redirect("/account");
}

const mfaVerifySchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code from your authenticator app."),
});

/**
 * Completes a pending TOTP challenge, elevating the session from aal1 to
 * aal2. Only ever has one factor to challenge in practice (enrollment
 * currently allows one active authenticator) — uses the first verified
 * factor rather than asking the user to pick.
 */
export async function verifyMfaChallengeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = mfaVerifySchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factor = factorsData?.totp.find((f) => f.status === "verified");
  if (!factor) {
    return { error: "No authenticator app is enrolled on this account." };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) {
    return { error: challengeError?.message ?? "Could not start the verification challenge." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) {
    return { error: "That code didn't match — check the time on your device and try again." };
  }

  const redirectTo = formData.get("redirect_to");
  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/account");
}

const emailSchema = z.object({ email: z.string().email("Enter a valid email address.") });

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  // Always report success to avoid leaking which emails are registered.
  return { error: null };
}

const newPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function updatePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message };
  }

  redirect("/account");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // Absolute, for the same reason as deniedDestination() in session.ts: a bare
  // "/" on a portal subdomain is that portal's own root, so signing out of the
  // admin console would land back on the admin login rather than the public
  // site.
  redirect(rootOrigin() || "/");
}
