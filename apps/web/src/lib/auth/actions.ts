"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pathPrefixFor, rootOrigin, type PortalSubdomain } from "@/lib/subdomain";
import { recordLoginEvent } from "@/lib/auth/login-history";

/** `orderId` is set by desk bookings so a group submission can collect the orders it created. */
export type ActionState = {
  error: string | null;
  destination?: string;
  orderId?: string;
} | null;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A plain customer belongs on the marketing site, not in the account shell:
  // they log in to browse and book, and dropping them on a profile form with
  // four zeroed stat cards reads as a dead end. Every business role instead
  // lands on /account (below) — never in a portal directly — so the
  // switcher is always how a partner identity gets reached, not a silent
  // login-time swap. redirect_to always wins when present.
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
    // (see cookieDomain) has nothing to separate — a bare admin redirect
    // would drop them straight into the console from the public form.
    // Refusing here is the strongest boundary available in path-based mode,
    // and it mirrors signInToPortalAction, which already turns non-admins
    // away from /admin/login.
    //
    // Sign back out first: leaving a valid admin session attached to a
    // "rejected" sign-in would defeat the entire point. The error is
    // deliberately the same generic line as a wrong password below — naming
    // the account's real type here would let this form be used to test
    // whether a given email is staff/a manager, which is exactly the kind
    // of account-enumeration leak a login form must not offer.
    if (profile?.is_platform_admin) {
      await supabase.auth.signOut();
      return { error: "Incorrect email or password." };
    }

    // hotel_manager is deliberately NOT one of the unified-identity roles
    // below — unlike agent/affiliate/hotel_partner/venue_partner (each its
    // own B2C account that also applied for a program), a manager is an
    // admin-assigned staff seat on a specific hotel with no B2C account of
    // its own behind it. Rejected here the same way is_platform_admin is,
    // rather than folded into /account: 2026-08-23, after a manager account
    // reached the customer site via the account switcher and could switch
    // back into a "My Account" view that isn't really theirs. Same generic
    // error as above, for the same reason.
    if (profile?.role === "hotel_manager") {
      await supabase.auth.signOut();
      return { error: "Incorrect email or password." };
    }

    if (profile) {
      // agent, affiliate, hotel_partner, and venue_partner all land on
      // /account uniformly now: none of the four is a separate portal
      // citizen on the shared customer form (only /agent/login and
      // /admin/login are dedicated entry points). Each is, by design, still
      // first and foremost the same B2C account that applied — landing on
      // /account (which surfaces every approved partner identity via
      // getMyPartnerContexts, see account/page.tsx) keeps that account
      // usable as a customer while still surfacing every partner capability
      // through the switcher, rather than the login silently swapping the
      // B2C dashboard out for whichever one role column happened to hold.
      // Confirmed for affiliate 2026-08-14; hotel_partner reported the same
      // "landed in the Partner Portal instead of my B2C account" 2026-08-16;
      // agent was the last inconsistent case, fixed 2026-08-20 alongside the
      // multi-context account switcher.
      if (
        profile.role === "affiliate" ||
        profile.role === "hotel_partner" ||
        profile.role === "venue_partner" ||
        profile.role === "agent"
      ) {
        roleDestination = "/account";
      }
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

type PortalKind = PortalSubdomain;

const PORTAL_LOGIN_META: Record<PortalKind, { audienceError: string }> = {
  agent: { audienceError: "This account doesn't have agent access." },
  admin: { audienceError: "This account doesn't have admin access." },
  manager: { audienceError: "This account doesn't have hotel manager access." },
  affiliate: { audienceError: "This account doesn't have affiliate access." },
  partner: { audienceError: "This account doesn't have hotel partner access." },
  venue: { audienceError: "This account doesn't have venue partner access." },
};

/**
 * Default post-login destination for signInToPortalAction — deliberately a
 * RELATIVE path ("/admin", "/agent"), not portalHref()'s absolute
 * cross-origin URL. This action is only ever submitted FROM the portal's
 * own origin (the dedicated /agent/login and /admin/login pages — see the
 * comment on portalLoginHref in lib/subdomain.ts for why it must stay that
 * way), so the redirect target is always same-origin in practice, and a
 * relative path avoids a genuine Next.js 16.2.12 quirk: `redirect()` to an
 * ABSOLUTE url pointing at the request's OWN origin was observed sending
 * the browser's follow-up request with Host: localhost instead of the
 * actual subdomain host — landing on proxy.ts's root-host isolation block
 * (a 404) instead of the portal. Confirmed via temporary diagnostic
 * logging: the Server Action itself completed successfully (credentials
 * verified, admin check passed, MFA check passed) every time — the failure
 * was purely in how the client followed the resulting redirect. A relative
 * path never has this ambiguity: proxy.ts's own rewrite (or direct
 * Next.js routing in path-based/Phase-1 mode) resolves it on whatever
 * origin the browser is already on.
 */
function portalDestination(portal: PortalKind): string {
  return pathPrefixFor(portal);
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

async function hasActiveHotelManagerRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("hotel_managers")
    .select("hotel_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function hasAffiliateRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  // Existence only, not status — a suspended affiliate still has account
  // audience; affiliate/layout.tsx shows the suspension notice from there,
  // same as agency/hotel-partner suspension does in their own layouts.
  const { data } = await supabase.from("affiliates").select("id").eq("profile_id", userId).maybeSingle();
  return !!data;
}

/**
 * Mirrors modules/hotels/partner-queries.ts::getMyHotelScope, inlined
 * rather than imported: lib never depends on modules (see
 * modules/README.md) — a plain hotel_manager with no hotel_partner_members
 * row of their own still holds this audience via my_operable_hotel_ids.
 */
async function hasHotelPartnerScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const [{ data: member }, { data: hotelIds }] = await Promise.all([
    supabase
      .from("hotel_partner_members")
      .select("partner_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase.rpc("my_operable_hotel_ids"),
  ]);
  return !!member || (hotelIds?.length ?? 0) > 0;
}

/** Mirrors modules/events/venue-partner-queries.ts::getMyVenuePartnerId, inlined for the same reason as hasHotelPartnerScope above. */
async function hasVenuePartnerMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("venue_partner_members")
    .select("partner_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Per-portal "does this authenticated account actually belong here" check,
 * run before a portal login is allowed to succeed. Admin is the one case
 * read directly off `profiles` (a single boolean flag); every other portal
 * is a membership-table lookup, since one flat `profiles.role` column can't
 * represent "which programs is this account actually a member of" (an
 * account can hold more than one).
 */
async function holdsPortalAudience(
  portal: PortalKind,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  switch (portal) {
    case "admin": {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", userId)
        .single();
      return !!profile?.is_platform_admin;
    }
    case "agent":
      return hasActiveAgencyMembership(supabase, userId);
    case "manager":
      return hasActiveHotelManagerRow(supabase, userId);
    case "affiliate":
      return hasAffiliateRow(supabase, userId);
    case "partner":
      return hasHotelPartnerScope(supabase, userId);
    case "venue":
      return hasVenuePartnerMembership(supabase, userId);
  }
}

/**
 * Shared sign-in logic for every dedicated portal login route (/agent/login,
 * /admin/login, /manager/login, /affiliate/login, /partner/login,
 * /venue/login). Unlike the plain /login form, this validates the
 * authenticated account actually holds the matching audience BEFORE
 * establishing a "successful login" state for that portal — a customer
 * submitting /admin/login sees a clear "doesn't have admin access" error
 * instead of landing on a broken or empty dashboard. See
 * holdsPortalAudience() for what "holds the audience" means per portal.
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

  if (!(await holdsPortalAudience(portal, supabase, user.id))) {
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
    return {
      error: null,
      destination: `/login/verify-2fa?redirect_to=${encodeURIComponent(finalDestination)}`,
    };
  }

  // A plain redirect() here — the framework-native way to do this — hits a
  // real Next.js 16.2.12 App Router bug: on a page reached via proxy.ts's
  // subdomain rewrite, the client's Server-Action-redirect-following code
  // sends its follow-up request with Host: localhost instead of the actual
  // subdomain host, landing on proxy.ts's OWN root-host isolation block (a
  // 404) instead of the portal — a real, reproducible framework defect,
  // not anything wrong with the destination path itself (confirmed via
  // temporary diagnostic logging: the exact same wrong "localhost" host
  // appeared whether finalDestination was relative or absolute, and even
  // after setting NEXT_PUBLIC_SITE_URL to an unrelated marker value, ruling
  // that out as the source too). Returning the destination as state instead
  // and letting the CLIENT perform a plain browser navigation (see
  // PortalLoginForm) sidesteps Next's redirect-following code entirely —
  // window.location.href is unambiguous about which origin it's on.
  return { error: null, destination: finalDestination };
}

export const signInToAgentPortalAction = signInToPortalAction.bind(null, "agent");
export const signInToAdminPortalAction = signInToPortalAction.bind(null, "admin");
export const signInToManagerPortalAction = signInToPortalAction.bind(null, "manager");
export const signInToAffiliatePortalAction = signInToPortalAction.bind(null, "affiliate");
export const signInToPartnerPortalAction = signInToPortalAction.bind(null, "partner");
export const signInToVenuePortalAction = signInToPortalAction.bind(null, "venue");

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
