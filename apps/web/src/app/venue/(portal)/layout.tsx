import type { Metadata } from "next";
import Link from "next/link";
import { requireUserForPortal } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyVenuePartnerId, getMyVenuePartner } from "@/modules/events/venue-partner-queries";
import { getMyPartnerAccountId, getPartnerAccount } from "@/modules/admin/partner-accounts";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { OnboardingStatusBanner } from "@/components/portal/onboarding-status-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Venue Portal",
    template: "%s | Venue Portal",
  },
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Venue Partner",
    items: [
      { href: "/venue", label: "Dashboard", icon: "overview" },
      { href: "/venue/venues", label: "My Venues", icon: "events" },
      { href: "/venue/bookings", label: "Booking Requests", icon: "bookings" },
    ],
  },
];

export default async function VenuePartnerLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program only has one role value on their profile
  // (whichever was approved last), but keeps every membership row they were
  // actually granted — gating on role alone would incorrectly lock them out
  // of programs they still belong to.
  const profile = await requireUserForPortal("venue");
  const partnerId = await getMyVenuePartnerId(profile.id);

  if (!partnerId) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">No active venue partner membership</p>
            <Button render={<Link href="/account/become?program=venue" />}>Apply to list your venue</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspension has to actually revoke access, not just flag the admin UI —
  // the Partner Management Console's suspend/offboard transitions flip
  // venue_partners.status, and this is where that bites.
  const partner = await getMyVenuePartner(partnerId);
  if (partner?.status === "suspended") {
    return <PortalSuspendedNotice portalLabel="Venue Portal" />;
  }

  const [accountId, contexts] = await Promise.all([
    getMyPartnerAccountId("venue_partner", partnerId),
    getMyPartnerContexts(profile.id, profile.full_name),
  ]);
  const account = accountId ? await getPartnerAccount(accountId) : null;

  return (
    <PortalShell
      portalName="Venue Portal"
      roleLabel="Venue Partner"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
    >
      {account ? <OnboardingStatusBanner checklist={account.checklist} /> : null}
      {children}
    </PortalShell>
  );
}
