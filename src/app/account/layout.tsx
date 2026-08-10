import { requireUser } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/roles";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";

// "Become a Partner" (/account/become) is deliberately not a persistent
// sidebar item — the acquisition funnel belongs on the public marketing
// site (/agents, /partners, /affiliates, and the footer), not inside a
// logged-in customer's account nav. The route itself stays fully
// functional and reachable — it's the actual application-management page
// linked from those marketing pages and from the agent/partner/affiliate
// portals' "no membership yet" empty states.
// Grouped rather than one flat list: at nine items a single group reads as an
// undifferentiated wall, and these split cleanly along how often they're used —
// trips constantly, travel identity a few times a year, settings almost never.
const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Travel",
    items: [
      { href: "/account", label: "Overview", icon: "profile" },
      { href: "/account/bookings", label: "My Bookings", icon: "bookings" },
      { href: "/account/visa", label: "Visa Applications", icon: "visa" },
    ],
  },
  {
    label: "Travel profile",
    items: [
      { href: "/account/travelers", label: "Saved Travelers", icon: "team" },
      { href: "/account/documents", label: "Document Vault", icon: "invoice" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/account/payments", label: "Payments & Receipts", icon: "payments" },
      { href: "/account/preferences", label: "Preferences", icon: "integrations" },
      { href: "/account/security", label: "Security", icon: "security" },
    ],
  },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <PortalShell
      portalName="My Account"
      roleLabel={roleLabel(profile.role)}
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {children}
    </PortalShell>
  );
}
