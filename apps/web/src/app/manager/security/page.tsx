import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserForPortal } from "@/lib/auth/session";
import { managerRecoveryHref } from "@/lib/managers/identity";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { getMyManagedVenues } from "@/modules/events/venue-manager-queries";
import { ChangePasswordCard } from "@/modules/auth/components/security-panels";
import { PageHeader } from "@/components/ui/page-header";
import { PortalShell } from "@/components/portal/portal-shell";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import styles from "@/components/portal/operations-shell.module.css";
export const metadata: Metadata = { title: "Manager security" };
export default async function ManagerSecurityPage() {
  const profile = await requireUserForPortal("manager");
  const [hotels, venues] = await Promise.all([getMyManagedHotels(profile.id), getMyManagedVenues(profile.id)]);
  if (!hotels.length && !venues.length) notFound();
  return <PortalShell className={styles.shell} portalName="Manager Portal" roleLabel="Manager" accent="manager" profileName={profile.full_name} profileEmail={profile.manager_contact_email ?? profile.email} accountCode={profile.manager_code ?? undefined} navGroups={[{ label: "Account", items: [{ href: "/manager", label: "Dashboard", icon: "overview" }, { href: "/manager/security", label: "Security", icon: "security" }] }]}>
    <div className="max-w-2xl space-y-6"><PageHeader title="Security" /><StatRail className="sm:grid-cols-2"><StatRailItem label="Manager ID" value={<span className="font-mono text-base">{profile.manager_code ?? "—"}</span>} /><StatRailItem label="Contact email" value={profile.manager_contact_email ?? profile.email ?? "—"} /></StatRail><ChangePasswordCard forgotHref={managerRecoveryHref()} /></div>
  </PortalShell>;
}
