import { requireUser } from "@/lib/auth/session";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Account",
    items: [
      { href: "/account", label: "Overview", icon: "profile" },
      { href: "/account/bookings", label: "My Bookings", icon: "bookings" },
      { href: "/account/visa", label: "Visa Applications", icon: "visa" },
      { href: "/account/become", label: "Become a Partner", icon: "become-partner" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  agent: "Travel Agent",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
  admin: "Admin",
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <PortalShell
      portalName="My Account"
      roleLabel={ROLE_LABELS[profile.role] ?? profile.role}
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {children}
    </PortalShell>
  );
}
