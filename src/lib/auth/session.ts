import "server-only";
import { redirect } from "next/navigation";
import { rootOrigin } from "@/lib/subdomain";
import { createClient } from "@/lib/supabase/server";
import { mfaChallengePending } from "@/lib/auth/mfa";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/** Current signed-in user's profile, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

/**
 * Redirects to /login if not signed in, or to the MFA challenge if the user
 * has a verified TOTP factor but hasn't completed it this session (a
 * password-only sign-in reaches aal1 immediately — without this check, an
 * enrolled factor would be decorative rather than enforced). Use in Server
 * Components/layouts.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (await mfaChallengePending()) redirect("/login/verify-2fa");
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
function deniedDestination(): string {
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
