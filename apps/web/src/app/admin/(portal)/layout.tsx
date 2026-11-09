import type { Metadata } from "next";
import { after } from "next/server";
import { requireAdminPortalAccess } from "@/lib/auth/session";
import { hasVerifiedFactor } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal/portal-shell";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { fireDueEventReminders } from "@/modules/admin/calendar-reminders";
import { AdminNotificationBell } from "./admin-notification-bell";
import { NewOrderBanner } from "./new-order-banner";
import { ShieldAlert } from "lucide-react";
import { getAdminNavGroups } from "./navigation";
import styles from "@/components/portal/operations-shell.module.css";

/**
 * Portal-scoped title, set on the LAYOUT rather than per page: the root
 * layout's `title.default` is the B2C marketing string ("STS Somalia |
 * Flights, Hotels, Visa & Umrah"), which every admin page missing its own
 * `metadata` silently inherited — so the operator console's browser tab
 * advertised the customer storefront. Defining default+template here fixes
 * the whole subtree at once and keeps future pages correct by default.
 */
export const metadata: Metadata = {
  title: {
    default: "Admin Console",
    template: "%s | Admin Console",
  },
};

// HARD-CODED FOR NOW (2026-08-09, per user request): mandatory TOTP
// enforcement below is disabled so admin access doesn't block on enrolling
// an authenticator app during development. The gate, the enrollment UI, and
// MfaSettings are all still fully intact — this single flag is the only
// thing suppressing it. Flip back to true (or remove the flag entirely)
// before production.
const REQUIRE_ADMIN_MFA = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminPortalAccess();

  // Notifications load independently in the client; only shell data blocks entry.
  const supabase = await createClient();

  // Opportunistic reminder sweep — the real, always-on delivery path is the
  // Vercel Cron at /api/cron/admin-event-reminders (see vercel.json). This
  // keeps due reminders firing the moment any admin loads a page (local dev,
  // or before cron is configured) but runs after the response is sent, so
  // the page never waits on it. Idempotent via reminder_sent_at.
  // The client is built here, not inside the callback: a layout can't read
  // cookies() from within after().
  after(() => fireDueEventReminders(supabase));

  const [mfaEnabled, { data: navCountsRaw }] = await Promise.all([
    // Mandatory TOTP enrollment for the admin console: an account can hold
    // is_platform_admin and still have zero verified factors (enrollment is
    // opt-in everywhere else). Block every /admin route behind an inline
    // enrollment prompt rather than redirecting to /admin/security — that
    // route lives under this same layout, so a redirect would loop.
    hasVerifiedFactor(),
    supabase.rpc("admin_nav_counts"),
  ]);

  const navGroups = getAdminNavGroups((navCountsRaw ?? {}) as Record<string, number>);

  return (
    <PortalShell
      className={styles.shell}
      searchableNavigation
      portalName="Admin Console"
      roleLabel="Admin"
      navGroups={navGroups}
      profileName={profile.full_name}
      profileEmail={profile.email}
      isPlatformAdmin={profile.is_platform_admin}
      accent="admin"
      headerExtra={<AdminNotificationBell />}
      adminMenu={{
        mfaEnabled,
        supportEmail: process.env.SUPPORT_EMAIL ?? null,
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      }}
    >
      {REQUIRE_ADMIN_MFA && !mfaEnabled ? (
        <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Two-factor authentication required</h1>
          <div className="text-left">
            <MfaSettings factors={[]} />
          </div>
        </div>
      ) : (
        <>
          <NewOrderBanner />
          {children}
        </>
      )}
    </PortalShell>
  );
}
