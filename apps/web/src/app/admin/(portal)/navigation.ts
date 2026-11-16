import type { PortalNavGroup } from "@/components/portal/portal-shell";

/** Inventory first; secondary workspace tools remain available at the bottom. */
export const ADMIN_NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Catalog & inventory",
    alwaysOpen: true,
    items: [
      { href: "/admin/hotels", label: "Hotels", icon: "hotels", searchTerms: "properties rooms rates availability managers" },
      { href: "/admin/events", label: "Events & halls", icon: "events", searchTerms: "venues availability managers" },
      { href: "/admin/catalog/visa", label: "Visa products", icon: "catalog", searchTerms: "catalog countries pricing" },
      { href: "/admin/umrah/pool", label: "Umrah pool", icon: "catalog", searchTerms: "catalog group pricing" },
    ],
  },

  {
    label: "Bookings & fulfilment",
    items: [
      { href: "/admin/orders", label: "Orders & payments", icon: "orders", searchTerms: "flights tickets reservations bookings" },
      { href: "/admin/flights", label: "Flight bookings", icon: "bookings", searchTerms: "flights tickets e-tickets fares PNR amadeus" },
      { href: "/admin/visa", label: "Visa applications", icon: "visa", searchTerms: "cases processing documents" },
      { href: "/admin/visa/appointments", label: "Visa appointments", icon: "calendar" },
      { href: "/admin/umrah/requests", label: "Private Umrah requests", icon: "bookings", searchTerms: "quotes custom" },
      { href: "/admin/umrah/bookings", label: "Umrah bookings", icon: "umrah", searchTerms: "pilgrims group private" },
      { href: "/admin/umrah/departures", label: "Umrah departures", icon: "calendar", searchTerms: "seats manifests" },
    ],
  },
  {
    label: "Partners & agencies",
    items: [
      { href: "/admin/applications", label: "Partner applications", icon: "applications", searchTerms: "onboarding approvals agents" },
      { href: "/admin/agencies", label: "Travel agencies", icon: "agency", searchTerms: "agents B2B partner accounts onboarding markups commissions earnings review" },
      { href: "/admin/agency-tiers", label: "Agency tiers", icon: "tiers", searchTerms: "agents commission levels" },
      { href: "/admin/broadcasts", label: "Agency broadcasts", icon: "broadcast", searchTerms: "agents announcements notifications messages" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/finance/top-ups", label: "Wallet top-ups", icon: "credit-note", searchTerms: "deposits credit review" },
      { href: "/admin/finance/withdrawals", label: "Withdrawals", icon: "payouts", searchTerms: "payout earnings commission" },
      { href: "/admin/refunds", label: "Refund requests", icon: "refund" },
      { href: "/admin/reports/aging", label: "Aging report", icon: "aging", searchTerms: "receivables overdue outstanding balances" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: "team", searchTerms: "roles access staff customers" },
      { href: "/admin/security", label: "Security", icon: "security", searchTerms: "MFA two factor sessions" },
      { href: "/admin/integrations", label: "Integrations", icon: "integrations", searchTerms: "providers API credentials payment gateways" },
      { href: "/admin/site-settings", label: "Site settings", icon: "settings", searchTerms: "configuration contact branding" },
      { href: "/admin/audit-log", label: "Audit log", icon: "audit", searchTerms: "activity history changes" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Dashboard", icon: "overview" },
      { href: "/admin/queue", label: "Order queue", icon: "bookings", searchTerms: "requests pending decisions" },
      { href: "/admin/calendar", label: "Booking calendar", icon: "calendar", searchTerms: "events reminders appointments" },
    ],
  },
];

export function getAdminNavGroups(counts: Record<string, number>): PortalNavGroup[] {
  const badges: Record<string, number | undefined> = {
    "/admin/queue": counts.queue,
    "/admin/orders": counts.orders,
    "/admin/refunds": counts.refunds,
    "/admin/visa": counts.visa,
    "/admin/visa/appointments": counts.visa_appointments,
    "/admin/umrah/requests": counts.umrah_requests,
    "/admin/applications": counts.partner_applications,
    "/admin/finance/withdrawals": counts.payout_requests,
    "/admin/finance/top-ups": counts.topup_requests,
    // Both review queues are handled on the agency page; payouts and top-ups have their own destinations.
    "/admin/agencies": (counts.markup_requests ?? 0) + (counts.earnings_reviews ?? 0),
  };
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, badge: badges[item.href] || undefined })),
  }));
}
