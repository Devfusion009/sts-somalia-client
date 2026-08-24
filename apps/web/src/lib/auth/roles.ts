import type { AppRole } from "@/lib/auth/session";
import { portalHref } from "@/lib/subdomain";

/**
 * Display names for public.app_role.
 *
 * Typed as a total Record<AppRole, string> rather than Record<string, string>:
 * adding a value to the enum and regenerating types then fails to compile here
 * instead of silently rendering the raw slug ("hotel_partner") in the admin
 * user list. Three separate copies of this map had drifted apart before it was
 * centralised — admin users, admin dashboard, and the account shell.
 */
export const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Customer",
  agent: "Travel Agent",
  hotel_partner: "Hotel Partner",
  hotel_manager: "Hotel Manager",
  affiliate: "Affiliate",
  venue_partner: "Venue Partner",
  admin: "Admin",
};

export function roleLabel(role: AppRole | string): string {
  return ROLE_LABELS[role as AppRole] ?? role;
}

/** One badge to render against an account. */
export type AccountRoleBadge = {
  label: string;
  /** Platform admin is a privilege, not a business identity — it reads differently. */
  kind: "platform" | "business" | "membership";
};

/**
 * Every role an account actually holds, read from the database rather than
 * assumed from one column.
 *
 * `profiles.role` alone is not the whole truth:
 *
 *  - `is_platform_admin` is a separate column that `role` never reflects, so a
 *    platform admin whose business role is still 'customer' displayed as
 *    "Customer" — which is what the admin user list was showing for every
 *    admin on the platform.
 *  - Agency and hotel-partner access is granted by rows in agency_members /
 *    hotel_partner_members. approve_* flows call promote_user_role() to keep
 *    `role` in step, but an account can be added to a second organisation, or
 *    have `role` overwritten by a later approval, and the memberships are then
 *    the only accurate record.
 *
 * An account can legitimately hold several at once (a platform admin who also
 * runs a hotel), so this returns a list, not a winner.
 */
export function accountRoleBadges(account: {
  role: AppRole;
  is_platform_admin: boolean;
  agencyCount?: number;
  hotelPartnerCount?: number;
}): AccountRoleBadge[] {
  const badges: AccountRoleBadge[] = [];

  if (account.is_platform_admin) {
    badges.push({ label: "Platform Admin", kind: "platform" });
  }

  // The business role is worth showing on its own only when it says something
  // the membership badges don't already: a bare "Customer" next to "Platform
  // Admin" is noise, but "Travel Agent" with no agency row is a real signal
  // that a promotion happened without a membership being created.
  const hasMemberships = (account.agencyCount ?? 0) > 0 || (account.hotelPartnerCount ?? 0) > 0;
  if (!(account.role === "customer" && (account.is_platform_admin || hasMemberships))) {
    badges.push({ label: roleLabel(account.role), kind: "business" });
  }

  if (account.agencyCount) {
    badges.push({
      label: account.agencyCount > 1 ? `${account.agencyCount} agencies` : "Agency member",
      kind: "membership",
    });
  }
  if (account.hotelPartnerCount) {
    badges.push({
      label:
        account.hotelPartnerCount > 1
          ? `${account.hotelPartnerCount} hotel partners`
          : "Hotel partner",
      kind: "membership",
    });
  }

  return badges;
}

// Only admin/agent are on subdomains in the Phase 2 plan (see
// docs/B2B-PORTAL-SEPARATION-BUILD-PROMPT.md) — hotel_partner/affiliate
// stay path-based regardless, so their hrefs are always relative.
export const PORTAL_BY_ROLE: Partial<Record<AppRole, { href: string; label: string }>> = {
  hotel_partner: { href: "/partner", label: "Partner Portal" },
  hotel_manager: { href: "/manager", label: "Manager Portal" },
  affiliate: { href: "/affiliate", label: "Affiliate Dashboard" },
  venue_partner: { href: "/venue", label: "Venue Portal" },
};

/**
 * Resolves which portal an account lands in, as an href a plain <Link>/
 * redirect() can use directly. Once subdomains are configured
 * (NEXT_PUBLIC_APP_HOST set), admin/agent hrefs are absolute cross-origin
 * URLs (e.g. "https://admin.stssomalia.com/"); until then they're the
 * Phase 1 relative paths ("/admin", "/agent") — same shape either way, so
 * every caller (signInAction, the avatar-dropdown portal switch, etc.)
 * works unchanged.
 *
 * Admin is decided by is_platform_admin, not role='admin' — role is a
 * business identity that approval flows can overwrite, is_platform_admin
 * can't (see requirePlatformAdmin() in session.ts). An account can hold
 * both (e.g. a platform admin who also has an agent business role); admin
 * takes priority since that's the higher-privilege context.
 */
export function portalForProfile(profile: { role: AppRole; is_platform_admin: boolean }) {
  if (profile.is_platform_admin) {
    return { href: portalHref("admin"), label: "Admin Console" };
  }
  if (profile.role === "agent") {
    return { href: portalHref("agent"), label: "Agent Portal" };
  }
  return PORTAL_BY_ROLE[profile.role] ?? null;
}
