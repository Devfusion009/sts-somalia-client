// Shared partner-account types + state machine — deliberately NOT
// server-only: the console's client components (status buttons, member
// forms) need these at runtime in the browser, while the queries module
// (partner-accounts.ts, server-only) re-exports them for server callers.

export type PartnerAccountType = "agency" | "hotel_partner" | "affiliate";
export type PartnerAccountStatus = "onboarding" | "live" | "suspended" | "offboarded";

export const ACCOUNT_TYPE_FROM_SLUG: Record<string, PartnerAccountType> = {
  agency: "agency",
  "hotel-partner": "hotel_partner",
  affiliate: "affiliate",
};

export const ACCOUNT_SLUG_FROM_TYPE: Record<PartnerAccountType, string> = {
  agency: "agency",
  hotel_partner: "hotel-partner",
  affiliate: "affiliate",
};

export const ACCOUNT_TYPE_LABEL: Record<PartnerAccountType, string> = {
  agency: "Travel Agency",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
};

/**
 * The account state machine. Offboarded is terminal on purpose — there is
 * no "reactivate" out of it; reinstating a partner means a fresh
 * application (or a manual superadmin data fix), never a single click.
 * "rejected" is not a state here at all: only applications get rejected.
 */
export const VALID_TRANSITIONS: Record<PartnerAccountStatus, PartnerAccountStatus[]> = {
  onboarding: ["live", "suspended", "offboarded"],
  live: ["suspended", "offboarded"],
  suspended: ["live", "offboarded"],
  offboarded: [],
};

export const ENTITY_TABLE = {
  agency: "agencies",
  hotel_partner: "hotel_partners",
  affiliate: "affiliates",
} as const;

export type AccountMember = {
  id: string;
  role: string;
  status: string;
  profile: { id: string; full_name: string | null; email: string } | null;
};
