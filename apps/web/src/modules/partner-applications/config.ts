export type ApplicationKind = "agency" | "hotel_partner" | "affiliate" | "venue_partner";

export const APP_CONFIG: Record<
  ApplicationKind,
  {
    table:
      | "agency_applications"
      | "hotel_partner_applications"
      | "affiliate_applications"
      | "venue_partner_applications";
    nameField: "agency_name" | "business_name" | null;
    refRpc:
      | "generate_agency_application_ref"
      | "generate_hotel_partner_application_ref"
      | "generate_affiliate_application_ref"
      | "generate_venue_partner_application_ref";
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
  // Event-hall owners — a supplier like hotel_partner (paid out for completed
  // events, same settlement step), but a separate program: halls were
  // previously an admin-only catalog with no owner at all.
  venue_partner: {
    table: "venue_partner_applications",
    nameField: "business_name",
    refRpc: "generate_venue_partner_application_ref",
    hasSettlementStep: true,
    portalHref: "/venue",
    portalLabel: "Venue Portal",
    label: "Event Venue Partner",
    totalSteps: 6,
  },
};

/** Step numbers are always in this order; affiliate skips step 4 (settlement). */
export function stepsFor(kind: ApplicationKind): number[] {
  const cfg = APP_CONFIG[kind];
  return cfg.hasSettlementStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
}

export function stepLabel(kind: ApplicationKind, step: number): string {
  const labels: Record<number, string> = {
    1: kind === "affiliate" ? "About You" : "Business Details",
    2: kind === "affiliate" ? "Verification" : "Authorized Contact",
    3:
      kind === "hotel_partner"
        ? "Property Details"
        : kind === "venue_partner"
          ? "Venue Details"
          : kind === "affiliate"
            ? "Audience & Reach"
            : "Operations",
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
// Where an affiliate's audience actually is — the platform matters less than
// the geography, since it decides whether they can plausibly drive Somalia
// travel bookings at all.
export const AUDIENCE_LOCATIONS = [
  "somalia",
  "diaspora_gulf",
  "diaspora_europe",
  "diaspora_north_america",
  "mixed_international",
  "other",
] as const;
// Shared between the applicant-facing wizard and the admin review page, so
// the two never drift apart on what "diaspora_gulf" is supposed to mean.
export const AUDIENCE_LOCATION_LABELS: Record<(typeof AUDIENCE_LOCATIONS)[number], string> = {
  somalia: "Mainly in Somalia",
  diaspora_gulf: "Somali diaspora — Gulf",
  diaspora_europe: "Somali diaspora — Europe",
  diaspora_north_america: "Somali diaspora — North America",
  mixed_international: "Mixed / international",
  other: "Other",
};

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

// Human labels for the hotel vocabulary above — shared between the
// applicant-facing wizard (components/steps.tsx) and the admin application
// detail page, so a hotel's raw "sole_proprietorship" / "wifi" / "5" never
// leaks into either UI unformatted. Kept here (not steps.tsx) specifically
// so the admin page — a server component with no reason to import a "use
// client" file — can use them too.
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  aparthotel: "Aparthotel / Serviced apartments",
  guesthouse: "Guesthouse",
  resort: "Resort",
  hostel: "Hostel",
  villa: "Villa",
  boutique_bnb: "Boutique / B&B",
};

export const STAR_RATING_LABELS: Record<string, string> = {
  unrated: "Not officially rated",
  "1": "1 star",
  "2": "2 stars",
  "3": "3 stars",
  "4": "4 stars",
  "5": "5 stars",
};

export const AMENITY_LABELS: Record<string, string> = {
  wifi: "Free WiFi",
  parking: "Parking",
  pool: "Swimming pool",
  breakfast_included: "Breakfast included",
  airport_shuttle: "Airport shuttle",
  air_conditioning: "Air conditioning",
  restaurant: "On-site restaurant",
  gym: "Gym / fitness center",
  spa: "Spa",
  elevator: "Elevator",
  front_desk_24h: "24-hour front desk",
  non_smoking_rooms: "Non-smoking rooms available",
};

export const CANCELLATION_POLICY_LABELS: Record<string, { label: string; hint: string }> = {
  flexible: { label: "Flexible", hint: "Free cancellation up to 24h before check-in" },
  moderate: { label: "Moderate", hint: "Free cancellation up to 5 days before check-in" },
  strict: { label: "Strict", hint: "Non-refundable" },
};
// Venue partner's step-3 vocabulary — mirrors event_venues.event_types usage
// on the public Events & Halls pages.
export const VENUE_EVENT_TYPES = ["wedding", "engagement", "conference", "graduation", "corporate", "community"] as const;
// A hotel is paid OUT by STS for completed stays (less commission), unlike
// an agency which pays IN via wallet/credit line — payout cadence replaces
// the agency's "payment model" choice on the hotel settlement step.
export const PAYOUT_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export const PAYOUT_FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export const REJECT_COOLDOWN_DAYS = 30;

/** Bounds for "Year established". Read once at module load rather than
 * hardcoded, so the upper bound doesn't silently go stale each January. */
export const EARLIEST_BUSINESS_YEAR = 1900;
export const CURRENT_YEAR = new Date().getFullYear();

/**
 * How long after submitting an applicant may still change their own
 * application. Long enough to fix something spotted right after hitting
 * submit, short enough that a reviewer isn't verifying a moving target.
 * 'draft' and 'more_info_requested' ignore the window entirely — both mean
 * the application is explicitly back in the applicant's hands.
 *
 * Enforced for real by the applicant_can_edit() SQL function behind each
 * application table's UPDATE policy; this copy drives the UI and the server
 * actions' pre-checks. Keep the two in step.
 */
export const EDIT_WINDOW_HOURS = 2;

export function canApplicantEdit(status: string, submittedAt: string | null): boolean {
  if (status === "draft" || status === "more_info_requested") return true;
  if (status !== "pending" && status !== "under_review") return false;
  if (!submittedAt) return false;
  return Date.now() - new Date(submittedAt).getTime() < EDIT_WINDOW_HOURS * 3_600_000;
}

export function editWindowEndsAt(submittedAt: string | null): Date | null {
  if (!submittedAt) return null;
  return new Date(new Date(submittedAt).getTime() + EDIT_WINDOW_HOURS * 3_600_000);
}

export type DocSlot = { key: string; label: string; optional?: boolean; expiryField?: boolean };

/**
 * Shared with the server action that validates required documents before
 * advancing to review. Affiliate is an individual referring an existing B2C
 * platform, not a registered business being onboarded as a supplier/buyer —
 * a single identity check covers the actual risk (fraudulent payout claims),
 * so it skips the business-registration/trade-license/tax-registration/
 * proof-of-address paperwork the other two kinds need.
 */
export function docSlotsFor(kind: ApplicationKind): DocSlot[] {
  if (kind === "affiliate") {
    return [{ key: "contact_id", label: "Your ID or passport" }];
  }
  const base: DocSlot[] = [
    { key: "business_registration", label: "Business registration certificate" },
    { key: "trade_license", label: "Trade license", expiryField: true },
    { key: "tax_registration", label: "Tax registration certificate" },
    { key: "proof_of_address", label: "Proof of office address (utility bill or lease, issued within the last 3 months)" },
    { key: "contact_id", label: "Authorized contact's ID or passport" },
  ];
  if (kind === "agency") base.push({ key: "iata_license", label: "IATA number or travel association license", optional: true });
  if (kind === "hotel_partner") base.push({ key: "property_ownership", label: "Proof of property ownership or lease agreement" });
  if (kind === "venue_partner") base.push({ key: "property_ownership", label: "Proof of venue ownership or lease agreement" });
  return base;
}

/**
 * Splits required-but-missing slots into two reasons: never uploaded, vs.
 * uploaded but (for a slot with `expiryField`) still missing its expiry
 * date — trade_license is the only current case, and an expired/undated
 * license is exactly the thing a KYC gate exists to catch, so it blocks
 * the same way a missing file does rather than being a soft nudge.
 */
export function missingRequiredDocSlots(
  kind: ApplicationKind,
  refs: ReadonlyArray<{ key: string; expiry?: string | null }>
): { missingUpload: DocSlot[]; missingExpiry: DocSlot[] } {
  const byKey = new Map(refs.map((r) => [r.key, r]));
  const missingUpload: DocSlot[] = [];
  const missingExpiry: DocSlot[] = [];
  for (const slot of docSlotsFor(kind)) {
    if (slot.optional) continue;
    const ref = byKey.get(slot.key);
    if (!ref) {
      missingUpload.push(slot);
    } else if (slot.expiryField && !ref.expiry) {
      missingExpiry.push(slot);
    }
  }
  return { missingUpload, missingExpiry };
}
