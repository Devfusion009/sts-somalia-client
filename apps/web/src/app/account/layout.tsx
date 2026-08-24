import { redirect } from "next/navigation";
import { requireUser, deniedDestination } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/roles";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import { CustomerNotificationBell } from "@/components/portal/customer-notification-bell";
import { ACTIONABLE_TYPES } from "@/lib/notifications/actionable-types";
import { getServerTrpc } from "@/lib/trpc/server";

// "Become a Partner" (/account/become) also stays reachable from the public
// marketing site (/agents, /partners, /affiliates, and the footer) and from
// the agent/partner/affiliate portals' "no membership yet" empty states —
// but it's also the only place a customer can track a submitted agent/
// hotel-partner/affiliate application's status, so it belongs in the
// account nav too rather than only being reachable after re-finding a
// marketing link.
// Grouped rather than one flat list: at ten items a single group reads as an
// undifferentiated wall, and these split cleanly along how often they're used —
// trips constantly, travel identity a few times a year, settings almost never.
const NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Travel",
    items: [
      { href: "/account", label: "Overview", icon: "profile" },
      { href: "/account/bookings", label: "My Bookings", icon: "bookings" },
      { href: "/account/visa", label: "Visa Applications", icon: "visa" },
      { href: "/account/become", label: "Partner Applications", icon: "applications" },
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
  // Hotel managers have no B2C account of their own to land on here — see
  // the same rejection in signInAction. Only reachable by typing the URL
  // directly, since nothing links here for a manager anymore.
  if (profile.role === "hotel_manager") redirect(deniedDestination());
  const trpc = await getServerTrpc();
  const [notifications, contexts] = await Promise.all([
    trpc.notifications.unread.query({ limit: 10 }),
    getMyPartnerContexts(profile.id, profile.full_name),
  ]);

  // Same actionable set the notification bell alerts on — a rejected
  // document or an info request is the one case where "Partner Applications"
  // needs the customer's attention, not just a status update to glance at.
  const partnerApplicationBadge = notifications.filter((n) => ACTIONABLE_TYPES.has(n.type)).length || undefined;
  const navGroups: PortalNavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === "/account/become" ? { ...item, badge: partnerApplicationBadge } : item
    ),
  }));

  return (
    <PortalShell
      portalName="My Account"
      roleLabel={roleLabel(profile.role)}
      navGroups={navGroups}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
      headerExtra={<CustomerNotificationBell notifications={notifications} />}
    >
      {children}
    </PortalShell>
  );
}
