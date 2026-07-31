import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/lib/data/agent-portal";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Agent",
    items: [
      { href: "/agent", label: "Dashboard", icon: "overview" },
      { href: "/agent/bookings", label: "Bookings", icon: "bookings" },
      { href: "/agent/team", label: "Team", icon: "team" },
    ],
  },
];

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  // Checked via direct membership lookup, not profile.role: a user approved
  // for more than one program (e.g. hotel partner AND agent) only has one
  // role value on their profile (whichever was approved last), but keeps
  // every membership row they were actually granted — gating on role alone
  // would incorrectly lock them out of programs they still belong to.
  const profile = await requireUser();
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

  return (
    <PortalShell
      portalName="Agent Portal"
      roleLabel={membership.roleInAgency === "owner" ? "Agency Owner" : "Agency Staff"}
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {children}
    </PortalShell>
  );
}
