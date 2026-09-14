import { redirect } from "next/navigation";
import { requireUser, deniedDestination } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/roles";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyVisaActionRequiredCount } from "@/modules/visa/queries";
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
  const [notifications, contexts, visaActionRequired] = await Promise.all([
    // apps/api is a separate deployment (not yet reachable from every
    // environment) — the rest of the account portal has nothing to do with
    // notifications, so it shouldn't 500 just because that one dependency
    // is down.
    trpc.notifications.unread.query({ limit: 10 }).catch(() => []),
    getMyPartnerContexts(profile.id, profile.full_name),
    // Read straight from Postgres rather than the notifications list above,
    // so a customer still sees "documents needed" on the nav even when the
    // apps/api hop that feeds the bell is unreachable or the alert was
    // already dismissed.
    getMyVisaActionRequiredCount().catch(() => 0),
  ]);

  // Same actionable set the notification bell alerts on — a rejected
  // document or an info request is the one case where "Partner Applications"
  // needs the customer's attention, not just a status update to glance at.
  const partnerApplicationBadge = notifications.filter((n) => ACTIONABLE_TYPES.has(n.type)).length || undefined;
  const navGroups: PortalNavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.href === "/account/become") return { ...item, badge: partnerApplicationBadge };
      if (item.href === "/account/visa") return { ...item, badge: visaActionRequired || undefined };
      return item;
    }),
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
