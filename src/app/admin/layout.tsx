import { requireRole } from "@/lib/auth/session";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";

const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Dashboard", icon: "overview" },
      { href: "/admin/applications", label: "Applications", icon: "applications" },
      { href: "/admin/orders", label: "Orders & Payments", icon: "orders" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/visa", label: "Visa Applications", icon: "visa" },
      { href: "/admin/events", label: "Events & Halls", icon: "events" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/catalog/visa", label: "Visa Catalog", icon: "catalog" },
      { href: "/admin/catalog/umrah", label: "Umrah Catalog", icon: "catalog" },
    ],
  },
  {
    label: "People",
    items: [{ href: "/admin/users", label: "Users", icon: "team" }],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");

  return (
    <PortalShell
      portalName="Admin Dashboard"
      roleLabel="Admin"
      navGroups={NAV_GROUPS}
      profileName={profile.full_name}
      profileEmail={profile.email}
    >
      {children}
    </PortalShell>
  );
}
