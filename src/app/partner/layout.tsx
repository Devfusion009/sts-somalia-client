import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId } from "@/lib/data/hotel-partner";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  return (
    <PortalShell
      portalName="Hotel Partner Portal"
      roleLabel="Hotel Partner"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {children}
    </PortalShell>
  );
}
