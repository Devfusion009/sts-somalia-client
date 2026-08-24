import type { Metadata } from "next";
import { requireAdminPortalAccess } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { createClient } from "@/lib/supabase/server";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { getServerTrpc } from "@/lib/trpc/server";
import { fireDueEventReminders } from "@/modules/admin/calendar-reminders";
import { AdminNotificationBell } from "./admin-notification-bell";
import { ShieldAlert } from "lucide-react";

// Reorganized (2026-08-20, per user request) from 7 groups into 6 grouped
// strictly by JOB rather than loose topic — the previous split had "Hotels"
// and "Events & Halls" (managing what's listed for sale) sitting in
// "Operations" while "Visa Catalog"/"Umrah Packages"/"Umrah Services" (the
// exact same kind of task — manage inventory) sat in a separate "Catalog"
// group. That inconsistency, not raw group count, was what read as fuzzy:
// two items of the same TYPE living in different buckets for no reason a
// user could infer. Fixed by moving every listing/inventory item into one
// "Catalog & Inventory" group and renaming the leftover queue-processing
// group to "Bookings & Orders" (every item in it is "a customer submitted
// something, I need to act on it" — a genuinely different job from
// managing what's for sale). Settings + Developer also merged: four
// platform-configuration items split into two groups of two had no
// defensible boundary either.
const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "overview" }],
  },
  {
    label: "Bookings & Orders",
    items: [
      // First in the group: the queue is the "what needs my hands right now"
      // surface for the manual-booking workflow — FIFO booking requests.
      { href: "/admin/queue", label: "Order Queue", icon: "bookings" },
      { href: "/admin/calendar", label: "Booking Calendar", icon: "calendar" },
      { href: "/admin/orders", label: "Orders & Payments", icon: "orders" },
      { href: "/admin/refunds", label: "Refund Requests", icon: "refund" },
      { href: "/admin/visa", label: "Visa Applications", icon: "visa" },
      { href: "/admin/umrah/requests", label: "Private Umrah", icon: "bookings" },
    ],
  },
  {
    label: "Catalog & Inventory",
    items: [
      { href: "/admin/hotels", label: "Hotels", icon: "hotels" },
      { href: "/admin/events", label: "Events & Halls", icon: "events" },
      { href: "/admin/catalog/visa", label: "Visa Catalog", icon: "catalog" },
      { href: "/admin/catalog/umrah", label: "Umrah Packages", icon: "catalog" },
      { href: "/admin/catalog/umrah/services", label: "Umrah Services", icon: "catalog" },
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
  const profile = await requireAdminPortalAccess();

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
  const trpc = await getServerTrpc();
  const [notifications, contexts, { data: navCountsRaw }] = await Promise.all([
    trpc.notifications.unread.query({ limit: 10 }),
    getMyPartnerContexts(profile.id, profile.full_name),
    supabase.rpc("admin_nav_counts"),
  ]);

  // Red count badges on the queue-shaped nav items — everything a customer
  // or partner submitted that is waiting on staff. One RPC round trip; the
  // bell's 30s router.refresh() re-runs this layout, so the numbers track
  // new arrivals on the same tick that surfaces their notifications.
  const navCounts = (navCountsRaw ?? {}) as Record<string, number>;
  const BADGE_BY_HREF: Record<string, number | undefined> = {
    "/admin/queue": navCounts.queue,
    "/admin/refunds": navCounts.refunds,
    "/admin/visa": navCounts.visa,
    "/admin/umrah/requests": navCounts.umrah_requests,
    "/admin/applications": navCounts.partner_applications,
  };
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, badge: BADGE_BY_HREF[item.href] || undefined })),
  }));

  return (
    <PortalShell
      portalName="Admin Console"
      roleLabel="Admin"
      navGroups={navGroups}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
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
