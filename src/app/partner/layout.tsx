import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getMyPartner } from "@/modules/hotels/partner-queries";
import { getMyPartnerAccountId, getPartnerAccount } from "@/modules/admin/partner-accounts";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { OnboardingStatusBanner } from "@/components/portal/onboarding-status-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Hotel Partner Portal",
    template: "%s | Hotel Partner Portal",
  },
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Partner",
    items: [
      { href: "/partner", label: "Dashboard", icon: "overview" },
      { href: "/partner/hotels", label: "My Hotels", icon: "hotels" },
      { href: "/partner/bookings", label: "Bookings", icon: "bookings" },
    ],
  },
];

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program only has one role value on their profile
  // (whichever was approved last), but keeps every membership row they were
  // actually granted — gating on role alone would incorrectly lock them out
  // of programs they still belong to.
  const profile = await requireUser();
  const partnerId = await getMyPartnerId(profile.id);

  if (!partnerId) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">No active hotel partner membership found</p>
            <p className="text-sm text-muted-foreground">
              You don&apos;t currently have an active hotel partner membership on this account.
            </p>
            <Button render={<Link href="/account/become" />}>Apply to list your hotel</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspension has to actually revoke access, not just flag the admin UI —
  // the Partner Management Console's suspend/offboard transitions flip
  // hotel_partners.status, and this is where that bites.
  const partner = await getMyPartner(partnerId);
  if (partner?.status === "suspended") {
    return <PortalSuspendedNotice portalLabel="Hotel Partner Portal" />;
  }

  const accountId = await getMyPartnerAccountId("hotel_partner", partnerId);
  const account = accountId ? await getPartnerAccount(accountId) : null;

  return (
    <PortalShell
      portalName="Hotel Partner Portal"
      roleLabel="Hotel Partner"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {account ? <OnboardingStatusBanner checklist={account.checklist} portalLabel="the Hotel Partner Portal" /> : null}
      {children}
    </PortalShell>
  );
}
