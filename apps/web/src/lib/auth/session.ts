import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { rootOrigin, portalLoginHref, type PortalSubdomain } from "@/lib/subdomain";
import { createClient } from "@/lib/supabase/server";
import { mfaChallengePending } from "@/lib/auth/mfa";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Current signed-in user's profile, or null if not signed in. Memoized per
 * request with React cache(): a portal layout, its page and the header all
 * ask, and each ask was a fresh auth-server round trip plus a profile read.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  // The profile read does not depend on the token check, so the two overlap
  // instead of running back to back (one network round trip saved on every
  // authenticated page). The id used for the read comes from the cookie, so it
  // is only trusted if getUser() — the authoritative check — agrees.
  const claimedId = await sessionUserId(supabase);
  const [{ data: { user }, error: userError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.auth.getUser(),
    claimedId
      ? supabase.from("profiles").select("*").eq("id", claimedId).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // An unreachable auth server is an outage, not a sign-out: returning null
  // here sent signed-in users to the login page whenever Supabase was slow.
  if (isAuthRetryableFetchError(userError)) throw userError;
  if (!user || user.id !== claimedId) return null;
  // PGRST116 = no profile row; anything else is a failed read.
  if (profileError && profileError.code !== "PGRST116") throw profileError;
  return profile;
});

/** `sub` of the access token in the session cookie, unverified — only ever used to start a read early. */
async function sessionUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const payload = session?.access_token.split(".")[1];
  if (!payload) return null;
  try {
    const { sub } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Redirects to /login if not signed in, or to the MFA challenge if the user
 * has a verified TOTP factor but hasn't completed it this session (a
 * password-only sign-in reaches aal1 immediately — without this check, an
 * enrolled factor would be decorative rather than enforced). Use in Server
 * Components/layouts.
 */
export async function requireUser(returnTo?: string): Promise<Profile> {
  const profile = await getCurrentProfile();
  const query = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? `?redirect_to=${encodeURIComponent(returnTo)}` : "";
  if (!profile) redirect(`/login${query}`);
  if (await mfaChallengePending()) redirect(`/login/verify-2fa${query}`);
  return profile;
}


/**
 * Where to send someone who is signed in but not allowed in this portal.
 *
 * MUST be absolute once portal subdomains are configured. A bare "/" on
 * admin.<host> is not the public site — the proxy rewrites it straight back to
 * /admin, which rejects them again and redirects to "/" again: an infinite
 * loop, and in a browser that follows it client-side, the B2C landing page
 * rendered on the admin origin. rootOrigin() is "" until subdomains are set
 * up, where a bare "/" is already correct.
 */
export function deniedDestination(): string {
  return rootOrigin() || "/";
}

/** Redirects to /login (unauthenticated) or the public site (wrong role). */
export async function requireRole(...roles: AppRole[]): Promise<Profile> {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) {
    redirect(deniedDestination());
  }
  return profile;
}

/**
 * Gate for platform-admin-only access. Checks `profiles.is_platform_admin`,
 * a dedicated flag — deliberately NOT `profiles.role === "admin"`. The flat
 * role column is a business-role identity (customer/agent/hotel_partner/
 * affiliate) that gets overwritten by approval flows like
 * promote_user_role(); is_platform_admin is a separate column only
 * set_platform_admin() can touch, so approving an agency/hotel/affiliate
 * application can never again silently demote an admin's own account.
 * Mandatory TOTP enrollment for admins is enforced separately in
 * `app/admin/layout.tsx` (a blocking view, not a redirect, to avoid locking
 * an unenrolled admin out of the enrollment page itself).
 */
export async function requirePlatformAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (!profile.is_platform_admin) {
    redirect(deniedDestination());
  }
  return profile;
}

/**
 * Same "must be signed in" gate as requireUser(), but for a portal's OWN
 * top-level layout specifically: an unauthenticated visitor is sent to that
 * portal's dedicated sign-in (portalLoginHref(portal) — e.g. "/admin/login"
 * or "/agent/login" in Phase 1/path-based mode, or the portal subdomain's
 * "/login" once subdomains are configured) rather than the generic customer
 * "/login".
 *
 * That distinction matters here specifically: the customer form actively
 * REJECTS staff/agent credentials (see signInAction) and points them at
 * this same portal sign-in — so bouncing a signed-out admin/agent to the
 * customer form first is a dead end that reads as "the portal is broken,"
 * not just a detour. Every OTHER requireUser()/requirePlatformAdmin() call
 * site is reached only from inside an already-authenticated session (a
 * server action, an export route), where hitting this edge case at all
 * means the session expired mid-request — a much rarer path where the
 * generic redirect is fine.
 */
export async function requireUserForPortal(portal: PortalSubdomain): Promise<Profile> {
  // The MFA check reads the session, not the profile, so it overlaps the
  // profile lookup instead of waiting behind it. Redirect order is unchanged.
  const [profile, mfaPending] = await Promise.all([getCurrentProfile(), mfaChallengePending()]);
  if (!profile) redirect(portalLoginHref(portal));
  if (mfaPending) redirect("/login/verify-2fa");
  return profile;
}

/** requireUserForPortal("admin") + the is_platform_admin check — see requirePlatformAdmin(). */
export async function requireAdminPortalAccess(): Promise<Profile> {
  const profile = await requireUserForPortal("admin");
  if (!profile.is_platform_admin) redirect(deniedDestination());
  return profile;
}
