import type { Metadata } from "next";
import { after } from "next/server";
import { requireAdminPortalAccess } from "@/lib/auth/session";
import { hasVerifiedFactor } from "@/lib/auth/mfa";
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
//
// "Finance" added (2026-09-03, per user request) on the same job-not-topic
// rule: moving money is its own job, and it had no home at all — payout
// requests were reachable only by drilling into one agency at a time, which
// is the wrong shape for a bank run that spans agencies. It costs no extra
// group: "Reports" was a single Aging Report (a receivables view, so it
// belongs here anyway) and Refund Requests moved across from Bookings &
// Orders, where it was the one item that isn't a customer booking to
// fulfil. Wallet top-ups got its own item the same way Withdrawals did
// (2026-09-07) — it was reachable only by drilling into one agency at a
// time, so an admin had no way to see money sent by other agencies waiting
// to be confirmed. Earnings review is the one still living on the agency
// page today.
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
      { href: "/admin/umrah/requests", label: "Private Umrah", icon: "bookings" },
      { href: "/admin/umrah/bookings", label: "Umrah Bookings", icon: "bookings" },
      { href: "/admin/umrah/departures", label: "Umrah Departures", icon: "calendar" },
    ],
  },
  {
    label: "Visa Operations",
    items: [
      { href: "/admin/visa", label: "Visa Applications", icon: "visa" },
      { href: "/admin/visa/appointments", label: "Visa Appointments", icon: "calendar" },
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
    label: "Finance",
    items: [
      // First two: someone is waiting on money in both directions — an
      // agency that already sent cash/EVC and is blocked from booking until
      // it's credited, or one that's owed a payout. Neither can happen
      // anywhere but here.
      { href: "/admin/finance/top-ups", label: "Top-ups", icon: "credit-note" },
      { href: "/admin/finance/withdrawals", label: "Withdrawals", icon: "payouts" },
      { href: "/admin/refunds", label: "Refund Requests", icon: "refund" },
      { href: "/admin/reports/aging", label: "Aging Report", icon: "aging" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/users", label: "Users", icon: "team" },
      { href: "/admin/security", label: "Security", icon: "security" },
      { href: "/admin/integrations", label: "Integrations", icon: "integrations" },
      { href: "/admin/site-settings", label: "Site settings", icon: "settings" },
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

  // Independent of each other, so they run together instead of as a chain of
  // round trips: the layout re-runs on every 30s bell refresh, which made each
  // extra serial hop a recurring cost, not a one-off.
  const supabase = await createClient();
  const trpc = await getServerTrpc();

  // Opportunistic reminder sweep — the real, always-on delivery path is the
  // Vercel Cron at /api/cron/admin-event-reminders (see vercel.json). This
  // keeps due reminders firing the moment any admin loads a page (local dev,
  // or before cron is configured) but runs after the response is sent, so
  // the page never waits on it. Idempotent via reminder_sent_at.
  // The client is built here, not inside the callback: a layout can't read
  // cookies() from within after().
  after(() => fireDueEventReminders(supabase));

  const [mfaEnabled, notifications, contexts, { data: navCountsRaw }] = await Promise.all([
    // Mandatory TOTP enrollment for the admin console: an account can hold
    // is_platform_admin and still have zero verified factors (enrollment is
    // opt-in everywhere else). Block every /admin route behind an inline
    // enrollment prompt rather than redirecting to /admin/security — that
    // route lives under this same layout, so a redirect would loop.
    hasVerifiedFactor(),
    // apps/api is a separate deployment (not yet reachable from every
    // environment) — the rest of the admin portal has nothing to do with
    // notifications, so it shouldn't 500 just because that one dependency
    // is down.
    trpc.notifications.unread.query({ limit: 10 }).catch(() => []),
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
    "/admin/visa/appointments": navCounts.visa_appointments,
    "/admin/umrah/requests": navCounts.umrah_requests,
    "/admin/applications": navCounts.partner_applications,
    // Requests waiting to be reviewed, plus approved ones waiting to be
    // sent — both are work only an admin can clear.
    "/admin/finance/withdrawals": navCounts.payout_requests,
    // Offline top-ups an agency says it already sent — reviewing one credits
    // the wallet immediately, so this is time-sensitive the same way a
    // payout is.
    "/admin/finance/top-ups": navCounts.topup_requests,
    // The agency decisions that still have no home of their own — markup
    // changes and earnings waiting on review — are made on an agency's own
    // page, so they share that page's badge rather than splitting into nav
    // items that would lead back to the same place. Payouts and top-ups
    // left this sum when they got their own items: counting the same
    // request twice would make the sidebar overstate the backlog.
    "/admin/agencies": (navCounts.markup_requests ?? 0) + (navCounts.earnings_reviews ?? 0),
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
