import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireUserForPortal } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { getAgencyOnboardingChecklist } from "@/modules/admin/partner-accounts";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { OnboardingStatusBanner } from "@/components/portal/onboarding-status-banner";
import { AgentNotificationBell } from "@/components/portal/agent-notification-bell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AGENT_SERVICES } from "@/modules/agencies/services";
import styles from "@/components/portal/operations-shell.module.css";
import typography from "@/components/portal/agent-typography.module.css";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Agent Portal",
    template: "%s | Agent Portal",
  },
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Workspace",
    alwaysOpen: true,
    items: [
      { href: "/agent", label: "Dashboard", icon: "overview" },
      { href: "/agent/book", label: "New booking", icon: "new-booking" },
      { href: "/agent/bookings", label: "Bookings", icon: "bookings" },
      { href: "/agent/customers", label: "Customers", icon: "profile" },
      { href: "/agent/finance", label: "Wallet", icon: "payouts" },
      { href: "/agent/reports", label: "Commissions & earnings", icon: "earnings" },
      { href: "/agent/calendar", label: "Booking calendar", icon: "calendar" },
      { href: "/agent/finance/transactions", label: "Transactions", icon: "payments" },
    ],
  },
  {
    label: "Book travel",
    alwaysOpen: true,
    items: AGENT_SERVICES.map((service) => ({ href: service.href, label: service.label, icon: service.icon })),
  },
  {
    label: "Operations",
    items: [
      { href: "/agent/finance/top-up", label: "Top up wallet", icon: "bank" },
      { href: "/agent/finance/withdrawals", label: "Withdraw earnings", icon: "bank" },
      { href: "/agent/finance/billing", label: "Billing", icon: "invoice" },
      { href: "/agent/markups", label: "Markups", icon: "catalog" },
      { href: "/agent/refunds", label: "Refunds", icon: "refund" },
    ],
  },
  {
    label: "Agency",
    items: [
      { href: "/agent/settings", label: "Agency profile", icon: "agency" },
      { href: "/agent/team", label: "Team", icon: "team" },
      { href: "/agent/bank-details", label: "Bank details", icon: "bank" },
      { href: "/agent/security", label: "Security", icon: "security" },
      { href: "/agent/personal-bookings", label: "Personal bookings", icon: "bookings" },
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
        <Card className="w-full">
          <CardContent>
            <Empty className="p-6 md:p-8">
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle className="text-base">No active agency membership</EmptyTitle>
              <EmptyContent>
                <Button render={<Link href="/account/become" />}>Apply to become an agent</Button>
              </EmptyContent>
            </Empty>
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

  // Account discovery is optional shell content; it must not block bookings or the wallet.
  const contexts = getMyPartnerContexts(profile.id, profile.full_name).catch(() => []);

  return (
    <PortalShell
      className={styles.shell}
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
      profileEmail={profile.email?.endsWith("@agent-login.scoutsts.invalid") ? membership.agency.contact_email : profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
      accent="agent"
      accountCode={profile.agent_code ?? membership.agency.agent_code}
      brandLogoUrl={agencyLogoUrl(membership.agency.logo_path)}
      brandName={membership.agency.name}
      headerExtra={<>
        {["owner", "admin", "booking_staff"].includes(membership.roleInAgency) ? <Button size="sm" render={<Link href="/agent/book" />}><Plus className="size-3.5" aria-hidden="true" /><span className="max-sm:sr-only">New booking</span></Button> : null}
        <AgentNotificationBell />
      </>}
    >
      <Suspense fallback={null}>
        <AgencyOnboarding agency={membership.agency} />
      </Suspense>
      <div className={typography.portal}>{children}</div>
    </PortalShell>
  );
}

async function AgencyOnboarding({ agency }: {
  agency: Parameters<typeof getAgencyOnboardingChecklist>[0];
}) {
  const checklist = await getAgencyOnboardingChecklist(agency);
  return checklist ? <OnboardingStatusBanner checklist={checklist} /> : null;
}
