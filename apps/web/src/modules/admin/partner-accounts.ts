import "server-only";
import { createClient } from "@/lib/supabase/server";
import { docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";

// ---------------------------------------------------------------------------
// Partner Accounts — the ongoing relationship created by approving an
// application (see supabase/migrations/20260809000006_partner_accounts.sql).
// This module is read-side: assembly of everything the Partner Management
// Console shows, plus the onboarding checklist + automatic go-live sweep.
// Mutations live in partner-account-actions.ts.
// ---------------------------------------------------------------------------

export {
  ACCOUNT_TYPE_FROM_SLUG,
  ACCOUNT_SLUG_FROM_TYPE,
  ACCOUNT_TYPE_LABEL,
  VALID_TRANSITIONS,
  ENTITY_TABLE,
} from "./partner-account-shared";
export type { PartnerAccountType, PartnerAccountStatus, AccountMember } from "./partner-account-shared";
import type { PartnerAccountType, PartnerAccountStatus, AccountMember } from "./partner-account-shared";

const APPLICATION_TABLE = {
  agency: "agency_applications",
  hotel_partner: "hotel_partner_applications",
  affiliate: "affiliate_applications",
  venue_partner: "venue_partner_applications",
} as const;

export type PartnerAccountRow = {
  id: string;
  type: PartnerAccountType;
  application_id: string;
  entity_id: string;
  status: PartnerAccountStatus;
  payment_terms: string | null;
  internal_notes: string | null;
  went_live_at: string | null;
  suspended_at: string | null;
  offboarded_at: string | null;
  created_at: string;
};

export type AccountEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
  actor: { full_name: string | null; email: string } | null;
};

export type ChecklistItem = {
  key: string;
  label: string;
  description: string;
  done: boolean;
  /** Console tab where this item is actually reviewed or resolved — omitted for
   * items that are only a fact captured on the original application, with no
   * corresponding action anywhere in this console. */
  tab?: "portfolio" | "commercial" | "documents" | "users";
};

export type DocumentRef = { key: string; label: string; storage_path: string; file_name: string; uploaded_at: string };

type ProfileRef = { full_name: string | null; email: string } | null;

export type PartnerAccountDetail = {
  account: PartnerAccountRow;
  application: {
    id: string;
    status: string;
    business_details: Record<string, unknown>;
    document_refs: DocumentRef[];
    submitted_at: string | null;
    reviewed_at: string | null;
    applicant: { id: string; full_name: string | null; email: string; phone: string | null } | null;
    reviewer: ProfileRef;
  };
  entity: {
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
    entityStatus: string;
    commissionRate: number;
  };
  members: AccountMember[];
  events: AccountEvent[];
  docReviews: Map<string, { status: string; note: string | null; reviewed_at: string | null; reviewer: ProfileRef }>;
  checklist: ChecklistItem[];
  // Type-specific payloads for the Properties/Portfolio/Commercial tabs.
  hotels: Array<{
    id: string;
    name: string;
    city: string;
    status: string;
    star_rating: number | null;
    rooms: Array<{ id: string; name: string; base_price: number; currency: string; status: string }>;
  }>;
  venues: Array<{ id: string; name: string; city: string; status: string; basePrice: number; currency: string }>;
  agencySnapshot: {
    creditBalance: number;
    creditLimit: number;
    tierName: string | null;
    commissionRateSetAt: string | null;
  } | null;
  affiliateSnapshot: {
    id: string;
    referralCode: string;
    totalEarned: number;
    totalPaid: number;
    linkCount: number;
  } | null;
  payouts: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    created_at: string;
  }>;
};

/** Applications list page: map application_id -> account id for "Manage" links. */
export async function getAccountIdsByApplication(
  type: PartnerAccountType,
  applicationIds: string[]
): Promise<Map<string, string>> {
  if (applicationIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_accounts")
    .select("id, application_id")
    .eq("type", type)
    .in("application_id", applicationIds);
  return new Map((data ?? []).map((row) => [row.application_id, row.id]));
}

export async function getPartnerAccountsIndex() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_accounts")
    .select("id, type, entity_id, status, created_at, went_live_at")
    .order("created_at", { ascending: false });
  const accounts = (data ?? []) as Array<
    Pick<PartnerAccountRow, "id" | "type" | "entity_id" | "status" | "created_at" | "went_live_at">
  >;

  // Resolve display names from the per-type entity tables in one query each.
  const byType = (t: PartnerAccountType) => accounts.filter((a) => a.type === t).map((a) => a.entity_id);
  const [agencies, hotelPartners, affiliates, venuePartners] = await Promise.all([
    byType("agency").length
      ? supabase.from("agencies").select("id, name").in("id", byType("agency"))
      : Promise.resolve({ data: [] }),
    byType("hotel_partner").length
      ? supabase.from("hotel_partners").select("id, name").in("id", byType("hotel_partner"))
      : Promise.resolve({ data: [] }),
    byType("affiliate").length
      ? supabase.from("affiliates").select("id, profile:profiles(full_name, email)").in("id", byType("affiliate"))
      : Promise.resolve({ data: [] }),
    byType("venue_partner").length
      ? supabase.from("venue_partners").select("id, name").in("id", byType("venue_partner"))
      : Promise.resolve({ data: [] }),
  ]);

  const names = new Map<string, string>();
  for (const a of agencies.data ?? []) names.set(a.id, a.name);
  for (const h of hotelPartners.data ?? []) names.set(h.id, h.name);
  for (const v of venuePartners.data ?? []) names.set(v.id, v.name);
  for (const f of affiliates.data ?? []) {
    const p = (f as { id: string; profile: { full_name: string | null; email: string } | null }).profile;
    names.set((f as { id: string }).id, p?.full_name || p?.email || "Affiliate");
  }

  return accounts.map((a) => ({ ...a, name: names.get(a.entity_id) ?? "—" }));
}

/**
 * Looks up the current partner's own account id (the "STS-XX-2026-NNNNNN"
 * reference), so their own portal layout can pull the same onboarding
 * checklist admin sees via getPartnerAccount() below — session-scoped, RLS
 * now grants the owner read access (see the
 * partner_reads_own_account_onboarding migration), so this is a plain
 * lookup, no service-role bypass.
 */
export async function getMyPartnerAccountId(type: PartnerAccountType, entityId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_accounts")
    .select("id")
    .eq("type", type)
    .eq("entity_id", entityId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getPartnerAccount(accountId: string): Promise<PartnerAccountDetail | null> {
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("partner_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return null;
  const acc = account as PartnerAccountRow;

  // Interpolated select strings defeat supabase-js's static type parsing
  // (same limitation documented in admin/queries.ts) — the query is valid
  // PostgREST, so the result is cast to the explicit shape below.
  type AppRow = {
    id: string;
    status: string;
    business_details: unknown;
    document_refs: unknown;
    submitted_at: string | null;
    reviewed_at: string | null;
    applicant: unknown;
    reviewer: unknown;
  };
  const [{ data: appData }, { data: eventRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from(APPLICATION_TABLE[acc.type])
      .select(
        "id, status, business_details, document_refs, submitted_at, reviewed_at, applicant:profiles!" +
          `${APPLICATION_TABLE[acc.type]}_applicant_id_fkey(id, full_name, email, phone), reviewer:profiles!${APPLICATION_TABLE[acc.type]}_reviewed_by_fkey(full_name, email)`
      )
      .eq("id", acc.application_id)
      .maybeSingle(),
    supabase
      .from("partner_account_events")
      .select("id, action, from_status, to_status, reason, created_at, actor:profiles(full_name, email)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_document_reviews")
      .select("doc_key, status, note, reviewed_at, reviewer:reviewed_by(full_name, email)")
      .eq("application_type", acc.type)
      .eq("application_id", acc.application_id),
  ]);
  if (!appData) return null;
  const app = appData as unknown as AppRow;

  const application: PartnerAccountDetail["application"] = {
    id: app.id,
    status: app.status,
    business_details: (app.business_details ?? {}) as Record<string, unknown>,
    document_refs: Array.isArray(app.document_refs) ? (app.document_refs as DocumentRef[]) : [],
    submitted_at: app.submitted_at,
    reviewed_at: app.reviewed_at,
    applicant: app.applicant as PartnerAccountDetail["application"]["applicant"],
    reviewer: app.reviewer as ProfileRef,
  };

  const events: AccountEvent[] = (eventRows ?? []).map((e) => ({
    ...e,
    actor: e.actor as unknown as ProfileRef,
  }));

  const docReviews = new Map(
    (reviewRows ?? []).map((r) => [
      r.doc_key,
      { status: r.status, note: r.note, reviewed_at: r.reviewed_at, reviewer: r.reviewer as unknown as ProfileRef },
    ])
  );

  // Per-type entity + members + tab payloads.
  let entity: PartnerAccountDetail["entity"];
  let members: AccountMember[] = [];
  let hotels: PartnerAccountDetail["hotels"] = [];
  let venues: PartnerAccountDetail["venues"] = [];
  let agencySnapshot: PartnerAccountDetail["agencySnapshot"] = null;
  let affiliateSnapshot: PartnerAccountDetail["affiliateSnapshot"] = null;
  let payouts: PartnerAccountDetail["payouts"] = [];

  if (acc.type === "agency") {
    const [{ data: agency }, { data: memberRows }, { data: payoutRows }] = await Promise.all([
      supabase
        .from("agencies")
        .select(
          "name, contact_email, contact_phone, status, commission_rate, commission_rate_set_at, credit_balance, credit_limit, tier:agency_tiers(name)"
        )
        .eq("id", acc.entity_id)
        .maybeSingle(),
      supabase
        .from("agency_members")
        .select("id, role_in_agency, status, profile:profiles(id, full_name, email)")
        .eq("agency_id", acc.entity_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("agency_commission_payouts")
        .select("id, amount, currency, method, payout_reference, created_at")
        .eq("agency_id", acc.entity_id)
        .order("created_at", { ascending: false }),
    ]);
    if (!agency) return null;
    entity = {
      name: agency.name,
      contactEmail: agency.contact_email,
      contactPhone: agency.contact_phone,
      entityStatus: agency.status,
      commissionRate: Number(agency.commission_rate),
    };
    agencySnapshot = {
      creditBalance: Number(agency.credit_balance),
      creditLimit: Number(agency.credit_limit),
      tierName: (agency.tier as unknown as { name: string } | null)?.name ?? null,
      commissionRateSetAt: agency.commission_rate_set_at,
    };
    members = (memberRows ?? []).map((m) => ({
      id: m.id,
      role: m.role_in_agency,
      status: m.status,
      profile: m.profile as unknown as AccountMember["profile"],
    }));
    payouts = (payoutRows ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      reference: p.payout_reference,
      created_at: p.created_at,
    }));
  } else if (acc.type === "hotel_partner") {
    const [{ data: partner }, { data: memberRows }, { data: hotelRows }] = await Promise.all([
      supabase
        .from("hotel_partners")
        .select("name, contact_email, contact_phone, status, commission_rate")
        .eq("id", acc.entity_id)
        .maybeSingle(),
      supabase
        .from("hotel_partner_members")
        .select("id, role_in_partner, status, profile:profiles(id, full_name, email)")
        .eq("partner_id", acc.entity_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("hotels")
        .select("id, name, city, status, star_rating, hotel_rooms(id, name, base_price, currency, status)")
        .eq("partner_id", acc.entity_id)
        .order("created_at", { ascending: false }),
    ]);
    if (!partner) return null;
    entity = {
      name: partner.name,
      contactEmail: partner.contact_email,
      contactPhone: partner.contact_phone,
      entityStatus: partner.status,
      commissionRate: Number(partner.commission_rate),
    };
    members = (memberRows ?? []).map((m) => ({
      id: m.id,
      role: m.role_in_partner,
      status: m.status,
      profile: m.profile as unknown as AccountMember["profile"],
    }));
    hotels = (hotelRows ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      status: h.status,
      star_rating: h.star_rating,
      rooms: (h.hotel_rooms ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        base_price: Number(r.base_price),
        currency: r.currency,
        status: r.status,
      })),
    }));
  } else if (acc.type === "venue_partner") {
    const [{ data: partner }, { data: memberRows }, { data: venueRows }] = await Promise.all([
      supabase
        .from("venue_partners")
        .select("name, contact_email, contact_phone, status, commission_rate")
        .eq("id", acc.entity_id)
        .maybeSingle(),
      supabase
        .from("venue_partner_members")
        .select("id, role_in_partner, status, profile:profiles(id, full_name, email)")
        .eq("partner_id", acc.entity_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_venues")
        .select("id, name, city, status, base_price, currency")
        .eq("partner_id", acc.entity_id)
        .order("created_at", { ascending: false }),
    ]);
    if (!partner) return null;
    entity = {
      name: partner.name,
      contactEmail: partner.contact_email,
      contactPhone: partner.contact_phone,
      entityStatus: partner.status,
      commissionRate: Number(partner.commission_rate),
    };
    members = (memberRows ?? []).map((m) => ({
      id: m.id,
      role: m.role_in_partner,
      status: m.status,
      profile: m.profile as unknown as AccountMember["profile"],
    }));
    venues = (venueRows ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      status: v.status,
      basePrice: Number(v.base_price),
      currency: v.currency,
    }));
  } else {
    // total_earned/total_paid no longer exist on affiliates (dropped in
    // 20260814000001 — they never had a writer, always read $0.00).
    // Computed live below from affiliate_conversions/commission_payouts
    // instead, same as the affiliate's own dashboard (src/app/affiliate/page.tsx).
    const [{ data: affiliate }, { count: linkCount }, { data: conversionRows }, { data: payoutRows }] =
      await Promise.all([
        supabase
          .from("affiliates")
          .select("referral_code, status, commission_rate, profile:profiles(id, full_name, email, phone)")
          .eq("id", acc.entity_id)
          .maybeSingle(),
        supabase.from("affiliate_links").select("*", { count: "exact", head: true }).eq("affiliate_id", acc.entity_id),
        supabase
          .from("affiliate_conversions")
          .select("commission_amount, status")
          .eq("affiliate_id", acc.entity_id)
          .neq("status", "reversed"),
        supabase
          .from("commission_payouts")
          .select("id, amount, currency, method, payout_reference, created_at")
          .eq("affiliate_id", acc.entity_id)
          .order("created_at", { ascending: false }),
      ]);
    if (!affiliate) return null;
    const profile = affiliate.profile as unknown as { id: string; full_name: string | null; email: string } | null;
    entity = {
      name: profile?.full_name || profile?.email || "Affiliate",
      contactEmail: profile?.email ?? null,
      contactPhone: null,
      entityStatus: affiliate.status,
      commissionRate: Number(affiliate.commission_rate),
    };
    payouts = (payoutRows ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      reference: p.payout_reference,
      created_at: p.created_at,
    }));
    affiliateSnapshot = {
      id: acc.entity_id,
      referralCode: affiliate.referral_code,
      totalEarned: (conversionRows ?? []).reduce((sum, c) => sum + Number(c.commission_amount), 0),
      totalPaid: payouts.reduce((sum, p) => sum + p.amount, 0),
      linkCount: linkCount ?? 0,
    };
  }

  const checklist = computeChecklist(acc.type, {
    businessDetails: application.business_details,
    documentRefs: application.document_refs,
    docReviews,
    hotels,
    venues,
    agencySnapshot,
    affiliateSnapshot,
    memberCount: members.filter((m) => m.status === "active").length,
  });

  return {
    account: acc,
    application,
    entity,
    members,
    events,
    docReviews,
    checklist,
    hotels,
    venues,
    agencySnapshot,
    affiliateSnapshot,
    payouts,
  };
}

/**
 * Onboarding checklist, computed live from real operational data — never a
 * hand-ticked list, so it can't drift from reality. Every required KYC doc
 * verified is common to all types; the rest reflects what "ready to
 * transact" genuinely means per program.
 */
function computeChecklist(
  type: PartnerAccountType,
  input: {
    businessDetails: Record<string, unknown>;
    documentRefs: DocumentRef[];
    docReviews: Map<string, { status: string }>;
    hotels: PartnerAccountDetail["hotels"];
    venues: PartnerAccountDetail["venues"];
    agencySnapshot: PartnerAccountDetail["agencySnapshot"];
    affiliateSnapshot: PartnerAccountDetail["affiliateSnapshot"];
    memberCount: number;
  }
): ChecklistItem[] {
  const d = input.businessDetails;
  const requiredDocs = docSlotsFor(type as ApplicationKind).filter((s) => !s.optional);
  const allDocsVerified =
    requiredDocs.length > 0 &&
    requiredDocs.every((slot) => input.docReviews.get(slot.key)?.status === "verified");

  const docsItem: ChecklistItem = {
    key: "docs_verified",
    label: "All KYC documents verified",
    description: `Every required document reviewed and marked verified (${requiredDocs.length} required).`,
    done: allDocsVerified,
    tab: "documents",
  };

  if (type === "venue_partner") {
    return [
      {
        key: "payout_details",
        label: "Payout details on file",
        description: "Bank account for event payouts captured on the application's Settlement step.",
        done: Boolean(d.bankName && d.bankAccountNumber),
      },
      docsItem,
      {
        key: "first_venue",
        label: "First venue listed in the portal",
        description: "The partner has created at least one event venue in their Venue Portal.",
        done: input.venues.length > 0,
        tab: "portfolio",
      },
    ];
  }

  if (type === "hotel_partner") {
    const roomTypes = Array.isArray(d.roomTypes) ? (d.roomTypes as unknown[]) : [];
    return [
      {
        key: "payout_details",
        label: "Payout details on file",
        description: "Bank account for stay payouts captured on the application's Settlement step.",
        done: Boolean(d.bankName && d.bankAccountNumber),
      },
      {
        key: "room_types_declared",
        label: "Room types & rates declared",
        description: "Room categories with indicative nightly rates captured on the application.",
        done: roomTypes.length > 0,
      },
      docsItem,
      {
        key: "first_property",
        label: "First property listed in the portal",
        description: "The partner has created at least one hotel in their Partner Portal.",
        done: input.hotels.length > 0,
        tab: "portfolio",
      },
      {
        key: "rooms_configured",
        label: "Rooms & live rates configured",
        description: "At least one bookable room with a nightly rate exists in the Partner Portal.",
        done: input.hotels.some((h) => h.rooms.length > 0),
        tab: "portfolio",
      },
    ];
  }

  if (type === "agency") {
    return [
      {
        key: "commission_configured",
        label: "Commission rate configured",
        description: "Platform commission agreed and explicitly set on the agency (Commercial tab).",
        done: Boolean(input.agencySnapshot?.commissionRateSetAt),
        tab: "commercial",
      },
      docsItem,
      {
        key: "funding",
        label: "Wallet funded or credit line set",
        description: "The agency can actually pay for bookings — wallet top-up or a credit limit.",
        done: Boolean(
          input.agencySnapshot && (input.agencySnapshot.creditBalance > 0 || input.agencySnapshot.creditLimit > 0)
        ),
        tab: "portfolio",
      },
      {
        key: "team_active",
        label: "Team access in place",
        description: "At least one active member can sign in to the Agent Portal.",
        done: input.memberCount > 0,
        tab: "users",
      },
    ];
  }

  return [
    {
      key: "referral_code",
      label: "Referral code issued",
      description: "A unique code the affiliate shares to attribute conversions.",
      done: Boolean(input.affiliateSnapshot?.referralCode),
      tab: "portfolio",
    },
    docsItem,
    {
      key: "first_link",
      label: "First referral link created",
      description: "The affiliate has generated at least one tracked link in their dashboard.",
      done: (input.affiliateSnapshot?.linkCount ?? 0) > 0,
      tab: "portfolio",
    },
  ];
}

/**
 * Automatic onboarding -> live promotion, evaluated opportunistically when
 * the console loads (same pattern as the admin layout's reminder sweep —
 * no cron dependency, fires the moment anyone looks). Idempotent: only
 * ever fires from 'onboarding' with a fully-green checklist.
 */
export async function evaluateAutoLive(detail: PartnerAccountDetail): Promise<PartnerAccountDetail> {
  if (detail.account.status !== "onboarding") return detail;
  if (!detail.checklist.every((item) => item.done)) return detail;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_accounts")
    .update({ status: "live", went_live_at: now })
    .eq("id", detail.account.id)
    .eq("status", "onboarding");
  if (error) return detail;

  await supabase.from("partner_account_events").insert({
    account_id: detail.account.id,
    actor: null,
    action: "went_live",
    from_status: "onboarding",
    to_status: "live",
    reason: "Onboarding checklist completed — promoted automatically.",
  });

  return {
    ...detail,
    account: { ...detail.account, status: "live", went_live_at: now },
    events: [
      {
        id: "auto-live-now",
        action: "went_live",
        from_status: "onboarding",
        to_status: "live",
        reason: "Onboarding checklist completed — promoted automatically.",
        created_at: now,
        actor: null,
      },
      ...detail.events,
    ],
  };
}
