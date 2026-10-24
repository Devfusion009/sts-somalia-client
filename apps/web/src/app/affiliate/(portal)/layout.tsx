import type { Metadata } from "next";
import Link from "next/link";
import { requireUserForPortal } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getServerTrpc } from "@/lib/trpc/server";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { PortalSuspendedNotice } from "@/components/portal/portal-suspended-notice";
import { Link2 } from "lucide-react";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Affiliate Dashboard",
    template: "%s | Affiliate Dashboard",
  },
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Affiliate",
    items: [
      { href: "/affiliate", label: "Dashboard", icon: "overview" },
      { href: "/affiliate/links", label: "My Links", icon: "links" },
      { href: "/affiliate/payouts", label: "Payouts", icon: "payouts" },
    ],
  },
];

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program only has one role value on their profile
  // (whichever was approved last), but keeps every membership row they were
  // actually granted — gating on role alone would incorrectly lock them out
  // of programs they still belong to.
  const profile = await requireUserForPortal("affiliate");
  const trpc = await getServerTrpc();
  // Distinguished from "no affiliate account" below: apps/api being
  // unreachable is not the same fact as this profile never having applied,
  // and telling a real affiliate the latter when it's actually the former
  // is actively misleading, not just an unhandled edge case.
  let affiliate;
  try {
    affiliate = await trpc.affiliates.me.query();
  } catch {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4">
        <div className="w-full">
          <UnavailableNotice label="Affiliate Dashboard" />
        </div>
      </main>
    );
  }

  if (!affiliate) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4">
        <Card className="w-full">
          <Empty>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>No affiliate account</EmptyTitle>
            <EmptyContent>
              <Button render={<Link href="/account/become?program=affiliate" />}>Apply to become an affiliate</Button>
            </EmptyContent>
          </Empty>
        </Card>
      </main>
    );
  }

  // Suspension has to actually revoke access, not just flag the admin UI —
  // the Partner Management Console's suspend/offboard transitions flip
  // affiliates.status, and this is where that bites.
  if (affiliate.status === "suspended") {
    return <PortalSuspendedNotice portalLabel="Affiliate Dashboard" />;
  }

  const contexts = await getMyPartnerContexts(profile.id, profile.full_name);

  return (
    <PortalShell
      portalName="Affiliate Dashboard"
      roleLabel="Affiliate"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
    >
      {children}
    </PortalShell>
  );
}
