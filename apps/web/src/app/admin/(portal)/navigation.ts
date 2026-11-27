import type { PortalNavGroup } from "@/components/portal/portal-shell";

/** One destination per task. Service operations and their catalog live together. */
export const ADMIN_NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Workspace",
    alwaysOpen: true,
    items: [
      { href: "/admin", label: "Dashboard", icon: "overview" },
      { href: "/admin/orders", label: "Orders & payments", icon: "orders", searchTerms: "all orders transactions reservations bookings payment requests" },
      { href: "/admin/flights", label: "Flight bookings", icon: "flights", searchTerms: "flights tickets e-tickets fares PNR amadeus" },
      { href: "/admin/calendar", label: "Booking calendar", icon: "calendar", searchTerms: "events reminders appointments schedule" },
      { href: "/admin/callbacks", label: "Callback requests", icon: "phone", searchTerms: "marketing leads contact customers enquiries" },
    ],
  },
  {
    label: "Visas",
    icon: "visa",
    items: [
      { href: "/admin/visa", label: "Applications", icon: "applications", searchTerms: "visa cases processing documents" },
      { href: "/admin/visa/appointments", label: "Appointments", icon: "calendar", searchTerms: "visa scheduling" },
      { href: "/admin/catalog/visa", label: "Products & pricing", icon: "catalog", searchTerms: "visa catalog countries centres requirements" },
    ],
  },
  {
    label: "Umrah",
    icon: "umrah",
    items: [
      { href: "/admin/umrah/bookings", label: "Bookings & requests", icon: "bookings", searchTerms: "orders pilgrims group payments seats" },
      { href: "/admin/umrah/departures", label: "Departures", icon: "calendar", searchTerms: "seats manifests" },
      { href: "/admin/umrah/pool", label: "Pool & packages", icon: "catalog", searchTerms: "catalog inventory group pricing capacity", activePaths: ["/admin/catalog/umrah"] },
    ],
  },
  {
    label: "Hotels & events",
    icon: "hotels",
    items: [
      { href: "/admin/queue", label: "Booking requests", icon: "applications", searchTerms: "order queue hotel hall waitlist pending approvals decisions" },
      { href: "/admin/hotels", label: "Hotels", icon: "hotels", searchTerms: "catalog inventory properties rooms rates availability managers" },
      { href: "/admin/events", label: "Events & halls", icon: "events", searchTerms: "catalog inventory venues availability managers" },
    ],
  },
  {
    label: "Partners & agencies",
    icon: "agency",
    items: [
      { href: "/admin/agencies", label: "Travel agencies", icon: "agency", searchTerms: "agents B2B partner accounts onboarding markups commissions earnings review" },
      { href: "/admin/applications", label: "Partner applications", icon: "applications", searchTerms: "onboarding approvals agents", activePaths: ["/admin/partners"] },
      { href: "/admin/agency-tiers", label: "Agency tiers", icon: "tiers", searchTerms: "agents commission levels" },
      { href: "/admin/broadcasts", label: "Broadcasts", icon: "broadcast", searchTerms: "agents agency announcements notifications messages" },
    ],
  },
  {
    label: "Finance",
    icon: "bank",
    items: [
      { href: "/admin/finance/top-ups", label: "Wallet top-ups", icon: "credit-note", searchTerms: "deposits credit review" },
      { href: "/admin/finance/payments", label: "Payments", icon: "payments", searchTerms: "payment in out transfer cashbook" },
      { href: "/admin/finance/withdrawals", label: "Withdrawals", icon: "payouts", searchTerms: "payout earnings commission" },
      { href: "/admin/refunds", label: "Refund requests", icon: "refund" },
      { href: "/admin/reports/aging", label: "Aging report", icon: "aging", searchTerms: "receivables overdue outstanding balances" },
    ],
  },
  {
    label: "Administration",
    icon: "settings",
    items: [
      { href: "/admin/users", label: "Users & access", icon: "team", searchTerms: "roles staff customers" },
      { href: "/admin/security", label: "Security", icon: "security", searchTerms: "MFA two factor sessions" },
      { href: "/admin/integrations", label: "Integrations", icon: "integrations", searchTerms: "providers API credentials payment gateways" },
      { href: "/admin/site-settings", label: "Site settings", icon: "settings", searchTerms: "configuration contact branding" },
      { href: "/admin/audit-log", label: "Audit log", icon: "audit", searchTerms: "activity history changes" },
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
