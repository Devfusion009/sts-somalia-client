import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireUserForPortal } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { getAgencyOnboardingChecklist } from "@/modules/admin/partner-accounts";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { OnboardingStatusBanner } from "@/components/portal/onboarding-status-banner";
import { AgentNotificationBell } from "@/components/portal/agent-notification-bell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import styles from "@/components/portal/operations-shell.module.css";
import { AgentSectionNavigation } from "./section-navigation";
import { AGENT_NAV_GROUPS } from "./navigation";
import typography from "@/components/portal/agent-typography.module.css";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Agent Portal",
    template: "%s | Agent Portal",
  },
};

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program (e.g. hotel partner AND agent) only has one
  // role value on their profile (whichever was approved last), but keeps
  // every membership row they were actually granted — gating on role alone
  // would incorrectly lock them out of programs they still belong to.
  const profile = await requireUserForPortal("agent");
  const membership = await getMyAgency(profile.id, true);

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
    return <PortalSuspendedNotice portalLabel="Agent Portal" agencyName={membership.agency.name} agentCode={profile.agent_code ?? membership.agency.agent_code} />;
  }

  // Account discovery is optional shell content; it must not block bookings or the wallet.
  const contexts = getMyPartnerContexts(profile.id, profile.full_name).catch(() => []);

  return (
    <PortalShell
      className={`${styles.shell} ${typography.shell}`}
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
      navGroups={AGENT_NAV_GROUPS}
      searchableNavigation
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
      <div className={typography.portal}><AgentSectionNavigation />{children}</div>
    </PortalShell>
  );
}

async function AgencyOnboarding({ agency }: {
  agency: Parameters<typeof getAgencyOnboardingChecklist>[0];
}) {
  const checklist = await getAgencyOnboardingChecklist(agency);
  return checklist ? <OnboardingStatusBanner checklist={checklist} /> : null;
}
