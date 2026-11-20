import type { PortalNavGroup } from "@/components/portal/portal-shell";

/** Daily work stays visible; supporting tasks each have one home. */
export const AGENT_NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Workspace",
    alwaysOpen: true,
    items: [
      { href: "/agent", label: "Dashboard", icon: "overview" },
      { href: "/agent/book", label: "New booking", icon: "new-booking", searchTerms: "create flight hotel visa umrah event reservation" },
      { href: "/agent/bookings", label: "Bookings", icon: "bookings", searchTerms: "agency orders tickets vouchers reservations" },
      { href: "/agent/customers", label: "Customers", icon: "profile", searchTerms: "travellers passengers clients" },
    ],
  },
  {
    label: "Booking tools",
    icon: "calendar",
    items: [
      { href: "/agent/calendar", label: "Booking calendar", icon: "calendar", searchTerms: "dates schedule departures appointments" },
      { href: "/agent/refunds", label: "Refunds", icon: "refund", searchTerms: "cancellations money back requests" },
      { href: "/agent/personal-bookings", label: "Personal bookings", icon: "bookings", searchTerms: "my own travel private trips" },
    ],
  },
  {
    label: "Finance",
    icon: "payouts",
    items: [
      { href: "/agent/finance", label: "Wallet", icon: "payouts", searchTerms: "balance credit funds" },
      { href: "/agent/finance/top-up", label: "Top up wallet", icon: "bank", searchTerms: "deposit add money funds credit" },
      { href: "/agent/finance/transactions", label: "Transactions", icon: "payments", searchTerms: "wallet ledger payment history debits credits" },
      { href: "/agent/finance/billing", label: "Billing & invoices", icon: "invoice", searchTerms: "receipts statements downloads" },
      { href: "/agent/reports", label: "Commissions & earnings", icon: "earnings", searchTerms: "reports revenue income settlement" },
      { href: "/agent/finance/withdrawals", label: "Withdraw earnings", icon: "bank", searchTerms: "payout cash out transfer settlement" },
    ],
  },
  {
    label: "Agency settings",
    icon: "settings",
    items: [
      { href: "/agent/settings", label: "Agency profile", icon: "agency", searchTerms: "company logo contact details" },
      { href: "/agent/team", label: "Team", icon: "team", searchTerms: "staff members roles access" },
      { href: "/agent/markups", label: "Pricing & markups", icon: "catalog", searchTerms: "fares margins rates rules" },
      { href: "/agent/bank-details", label: "Bank details", icon: "bank", searchTerms: "payout account settlement" },
      { href: "/agent/security", label: "Security", icon: "security", searchTerms: "password authentication sessions MFA" },
    ],
  },
];
