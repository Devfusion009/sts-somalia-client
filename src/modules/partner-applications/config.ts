export type ApplicationKind = "agency" | "hotel_partner" | "affiliate";

export const APP_CONFIG: Record<
  ApplicationKind,
  {
    table: "agency_applications" | "hotel_partner_applications" | "affiliate_applications";
    nameField: "agency_name" | "business_name" | null;
    refRpc:
      | "generate_agency_application_ref"
      | "generate_hotel_partner_application_ref"
      | "generate_affiliate_application_ref";
    hasSettlementStep: boolean;
    portalHref: string;
    portalLabel: string;
    label: string;
    totalSteps: number;
  }
> = {
  agency: {
    table: "agency_applications",
    nameField: "agency_name",
    refRpc: "generate_agency_application_ref",
    hasSettlementStep: true,
    portalHref: "/agent",
    portalLabel: "Agent Portal",
    label: "Travel Agent",
    totalSteps: 6,
  },
  hotel_partner: {
    table: "hotel_partner_applications",
    nameField: "business_name",
    refRpc: "generate_hotel_partner_application_ref",
    hasSettlementStep: true,
    portalHref: "/partner",
    portalLabel: "Partner Portal",
    label: "Hotel Partner",
    totalSteps: 6,
  },
  affiliate: {
    table: "affiliate_applications",
    nameField: null,
    refRpc: "generate_affiliate_application_ref",
    hasSettlementStep: false,
    portalHref: "/affiliate",
    portalLabel: "Affiliate Dashboard",
    label: "Affiliate",
    totalSteps: 5,
  },
};

/** Step numbers are always in this order; affiliate skips step 4 (settlement). */
export function stepsFor(kind: ApplicationKind): number[] {
  const cfg = APP_CONFIG[kind];
  return cfg.hasSettlementStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
}

export function stepLabel(kind: ApplicationKind, step: number): string {
  const labels: Record<number, string> = {
    1: "Business Details",
    2: "Authorized Contact",
    3: kind === "hotel_partner" ? "Property Details" : kind === "affiliate" ? "Audience & Reach" : "Operations",
    4: "Settlement",
    5: "Documents",
    6: "Review & Submit",
  };
  return labels[step] ?? `Step ${step}`;
}

export const BUSINESS_TYPES = ["sole_proprietorship", "partnership", "llc", "corporation"] as const;
export const VOLUME_RANGES = ["<20", "20-50", "50-100", "100-500", "500+"] as const;
export const PRODUCTS = ["flights", "hotels", "visa", "umrah", "halls"] as const;
export const TRAFFIC_SOURCES = ["social_media", "blog", "email_list", "paid_ads", "other"] as const;
export const PAYMENT_MODELS = ["prepaid_wallet", "credit_line"] as const;

// Hotel partner is a supplier onboarding onto the platform (mirrors Expedia
// Partner Central / Booking.com Partner Hub property setup), not a buyer
// like a travel agency — these fields exist ONLY for hotel_partner and
// intentionally have no agency/affiliate equivalent.
export const PROPERTY_TYPES = ["hotel", "aparthotel", "guesthouse", "resort", "hostel", "villa", "boutique_bnb"] as const;
export const STAR_RATINGS = ["unrated", "1", "2", "3", "4", "5"] as const;
export const AMENITIES = [
  "wifi",
  "parking",
  "pool",
  "breakfast_included",
  "airport_shuttle",
  "air_conditioning",
  "restaurant",
  "gym",
  "spa",
  "elevator",
  "front_desk_24h",
  "non_smoking_rooms",
] as const;
export const CANCELLATION_POLICIES = ["flexible", "moderate", "strict"] as const;
// A hotel is paid OUT by STS for completed stays (less commission), unlike
// an agency which pays IN via wallet/credit line — payout cadence replaces
// the agency's "payment model" choice on the hotel settlement step.
export const PAYOUT_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export const REJECT_COOLDOWN_DAYS = 30;

export type DocSlot = { key: string; label: string; optional?: boolean; expiryField?: boolean };

/** Shared with the server action that validates required documents before advancing to review. */
export function docSlotsFor(kind: ApplicationKind): DocSlot[] {
  const base: DocSlot[] = [
    { key: "business_registration", label: "Business registration certificate" },
    { key: "trade_license", label: "Trade license", expiryField: true },
    { key: "tax_registration", label: "Tax registration certificate" },
    { key: "proof_of_address", label: "Proof of office address (utility bill or lease, issued within the last 3 months)" },
    { key: "contact_id", label: "Authorized contact's ID or passport" },
  ];
  if (kind === "agency") base.push({ key: "iata_license", label: "IATA number or travel association license", optional: true });
  if (kind === "hotel_partner") base.push({ key: "property_ownership", label: "Proof of property ownership or lease agreement" });
  return base;
}
