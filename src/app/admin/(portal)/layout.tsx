import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { getUnreadNotifications } from "@/modules/notifications/queries";
import { fireDueEventReminders } from "@/modules/admin/calendar-reminders";
import { AdminNotificationBell } from "./admin-notification-bell";
import { ShieldAlert } from "lucide-react";

// Reorganized (2026-08-09, per user request) from 5 groups/16 flat items
// into topic-based groups that match how the work actually breaks down —
// the old split ("Admin" vs "Operations" vs "People") mixed unrelated
// things in the same bucket and, worse, had "Applications" (partner
// sign-up approvals) sitting right next to "Visa Applications" (customer
// document review) — two different features with near-identical names in
// different groups. Renamed the former to "Partner Applications" to remove
// that collision outright, not just relocate it.
const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "overview" }],
  },
  {
    label: "Operations",
    items: [
      // First in the group: the queue is the "what needs my hands right now"
      // surface for the manual-booking workflow — FIFO booking requests.
      { href: "/admin/queue", label: "Order Queue", icon: "bookings" },
      { href: "/admin/calendar", label: "Booking Calendar", icon: "calendar" },
      { href: "/admin/orders", label: "Orders & Payments", icon: "orders" },
      { href: "/admin/refunds", label: "Refund Requests", icon: "refund" },
      { href: "/admin/visa", label: "Visa Applications", icon: "visa" },
      { href: "/admin/events", label: "Events & Halls", icon: "events" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/catalog/visa", label: "Visa Catalog", icon: "catalog" },
      { href: "/admin/catalog/umrah", label: "Umrah Catalog", icon: "catalog" },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/admin/applications", label: "Partner Applications", icon: "applications" },
      { href: "/admin/partners", label: "Partner Accounts", icon: "become-partner" },
      { href: "/admin/agencies", label: "Agencies", icon: "agency" },
      { href: "/admin/agency-tiers", label: "Agency Tiers", icon: "tiers" },
      { href: "/admin/broadcasts", label: "Broadcasts", icon: "broadcast" },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/admin/reports/aging", label: "Aging Report", icon: "aging" }],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/users", label: "Users", icon: "team" },
      { href: "/admin/security", label: "Security", icon: "security" },
    ],
  },
  {
    label: "Developer",
    items: [
      { href: "/admin/integrations", label: "Integrations", icon: "integrations" },
      { href: "/admin/audit-log", label: "Audit Log", icon: "audit" },
    ],
  },
];

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
  const profile = await requirePlatformAdmin();

  // Mandatory TOTP enrollment for the admin console: an account can hold
  // is_platform_admin and still have zero verified factors (enrollment is
  // opt-in everywhere else). Block every /admin route behind an inline
  // enrollment prompt rather than redirecting to /admin/security — that
  // route lives under this same layout, so a redirect would loop.
  const factors = await listVerifiedFactors();

  // Opportunistic reminder sweep — the real, always-on delivery path is the
  // Vercel Cron at /api/cron/admin-event-reminders (see vercel.json), but
  // that requires production deployment + a plan tier with a frequent
  // enough schedule. Running the same idempotent check here means a due
  // reminder fires the moment any admin loads any admin page, which is what
  // makes this testable in local dev and resilient before/without cron
  // configured at all.
  const supabase = await createClient();
  await fireDueEventReminders(supabase);
  const notifications = await getUnreadNotifications(profile.id, { limit: 10 });

  return (
    <PortalShell
      portalName="Admin Console"
      roleLabel="Admin"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
      accent="admin"
      headerExtra={<AdminNotificationBell notifications={notifications} />}
    >
      {REQUIRE_ADMIN_MFA && factors.length === 0 ? (
        <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-heading text-xl font-bold">Two-factor authentication required</h1>
            <p className="text-sm text-muted-foreground">
              The admin console requires an enrolled authenticator app before you can continue.
              Set one up below — this only takes a minute.
            </p>
          </div>
          <div className="text-left">
            <MfaSettings factors={[]} />
          </div>
        </div>
      ) : (
        children
      )}
    </PortalShell>
  );
}
