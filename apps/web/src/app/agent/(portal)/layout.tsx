import type { Metadata } from "next";
import Link from "next/link";
import { requireUserForPortal } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { getMyPartnerAccountId, getPartnerAccount } from "@/modules/admin/partner-accounts";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { OnboardingStatusBanner } from "@/components/portal/onboarding-status-banner";
import { AgentNotificationBell } from "@/components/portal/agent-notification-bell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServerTrpc } from "@/lib/trpc/server";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Agent Portal",
    template: "%s | Agent Portal",
  },
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Agent",
    items: [
      { href: "/agent", label: "Dashboard", icon: "overview" },
      { href: "/agent/book", label: "New Booking", icon: "new-booking" },
      { href: "/agent/bookings", label: "Bookings", icon: "bookings" },
      { href: "/agent/calendar", label: "Event Calendar", icon: "calendar" },
      { href: "/agent/customers", label: "Customers", icon: "profile" },
    ],
  },
  // Ordered as the money actually moves: what's in the account, what moved
  // through it, what can be taken out, what STS billed, what was earned,
  // and the rate that earning is calculated from.
  {
    label: "Finance",
    items: [
      { href: "/agent/finance", label: "Overview", icon: "payouts" },
      { href: "/agent/finance/transactions", label: "Transactions", icon: "payments" },
      { href: "/agent/finance/withdrawals", label: "Withdraw Earnings", icon: "bank" },
      { href: "/agent/finance/billing", label: "Billing", icon: "invoice" },
      { href: "/agent/reports", label: "Earnings", icon: "earnings" },
      { href: "/agent/markups", label: "Markups", icon: "catalog" },
    ],
  },
  {
    label: "My Account",
    items: [
      { href: "/agent/bank-details", label: "Bank Details", icon: "bank" },
      { href: "/agent/refunds", label: "Refunds", icon: "refund" },
    ],
  },
  {
    label: "Agency",
    items: [
      { href: "/agent/settings", label: "Agency Profile", icon: "agency" },
      { href: "/agent/team", label: "Team", icon: "team" },
      { href: "/agent/security", label: "Security", icon: "security" },
    ],
  },
];

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program (e.g. hotel partner AND agent) only has one
  // role value on their profile (whichever was approved last), but keeps
  // every membership row they were actually granted — gating on role alone
  // would incorrectly lock them out of programs they still belong to.
  const profile = await requireUserForPortal("agent");
  const membership = await getMyAgency(profile.id);

  if (!membership) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">No active agency membership found</p>
            <p className="text-sm text-muted-foreground">
              You don&apos;t currently have an active agency membership on this account.
            </p>
            <Button render={<Link href="/account/become" />}>Apply to become an agent</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspension has to actually revoke access, not just flag the admin UI —
  // the Partner Management Console's suspend/offboard transitions flip
  // agencies.status, and this is where that bites.
  if (membership.agency.status === "suspended") {
    return <PortalSuspendedNotice portalLabel="Agent Portal" />;
  }

  const trpc = await getServerTrpc();
  const [accountId, contexts, notifications] = await Promise.all([
    getMyPartnerAccountId("agency", membership.agency.id),
    getMyPartnerContexts(profile.id, profile.full_name),
    // apps/api is a separate deployment (not yet reachable from every
    // environment) — the rest of the agent portal has nothing to do with
    // notifications, so it shouldn't 500 just because that one dependency
    // is down.
    trpc.notifications.unread.query({ limit: 10 }).catch(() => []),
  ]);
  const account = accountId ? await getPartnerAccount(accountId) : null;

  return (
    <PortalShell
      portalName="Agent Portal"
      roleLabel={
        {
          owner: "Agency Owner",
          admin: "Agency Admin",
          booking_staff: "Booking Staff",
          accountant: "Accountant",
          viewer: "Viewer",
        }[membership.roleInAgency] ?? "Agency Staff"
      }
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
      accent="agent"
      brandLogoUrl={agencyLogoUrl(membership.agency.logo_path)}
      headerExtra={<AgentNotificationBell notifications={notifications} />}
    >
      {account ? <OnboardingStatusBanner checklist={account.checklist} /> : null}
      {children}
    </PortalShell>
  );
}
