import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { bucketKey, enumerateBuckets } from "@/lib/date-range";

/**
 * Agency orders with their items joined to every vertical — the same embed
 * shape as the checkout query so `describeOrderItem` from the payments
 * module can label items uniformly.
 */
export async function getAgencyOrders(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `*,
       agency_customer:agency_customer_id (id, full_name, phone),
       order_items (
         *,
         hotel_booking:hotel_booking_id (id, check_in, check_out, num_rooms, guest_details, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (id, num_pilgrims, package:package_id (name)),
         hall_booking:hall_booking_id (id, start_date, end_date, event_type, venue:venue_id (name))
       ),
       payments (*)`
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type AgencyOrder = Awaited<ReturnType<typeof getAgencyOrders>>[number];

export async function getMyAgency(profileId: string) {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("agency_members")
    .select(
      "agency_id, role_in_agency, agencies(id, name, legal_name, registration_number, status, commission_rate, commission_rate_set_at, contact_email, contact_phone, country_code, credit_balance, credit_limit, logo_path, bank_name, bank_account_name, bank_account_number)"
    )
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership?.agencies) return null;

  return {
    agency: membership.agencies,
    roleInAgency: membership.role_in_agency,
  };
}

export type AgencyBooking = {
  id: string;
  type: "hotel" | "flight" | "visa" | "umrah";
  title: string;
  subtitle: string;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
};

export async function getAgencyBookings(agencyId: string): Promise<AgencyBooking[]> {
  const supabase = await createClient();

  const [hotelRes, flightRes, visaRes, umrahRes] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select("id, check_in, check_out, status, total_price, currency, created_at, hotels(name)")
      .eq("agency_id", agencyId),
    supabase
      .from("flight_bookings")
      .select("id, origin_iata, destination_iata, depart_at, status, total_price, currency, created_at")
      .eq("agency_id", agencyId),
    supabase
      .from("visa_applications")
      .select("id, status, price, currency, created_at, visa_types(name)")
      .eq("agency_id", agencyId),
    supabase
      .from("umrah_bookings")
      .select("id, status, total_price, currency, created_at, num_pilgrims, umrah_packages(name)")
      .eq("agency_id", agencyId),
  ]);

  const bookings: AgencyBooking[] = [
    ...(hotelRes.data ?? []).map((b) => ({
      id: b.id,
      type: "hotel" as const,
      title: b.hotels?.name ?? "Hotel booking",
      subtitle: `${b.check_in} → ${b.check_out}`,
      status: b.status,
      price: b.total_price,
      currency: b.currency,
      createdAt: b.created_at,
    })),
    ...(flightRes.data ?? []).map((b) => ({
      id: b.id,
      type: "flight" as const,
      title: `${b.origin_iata} → ${b.destination_iata}`,
      subtitle: new Date(b.depart_at).toLocaleDateString(),
      status: b.status,
      price: b.total_price,
      currency: b.currency,
      createdAt: b.created_at,
    })),
    ...(visaRes.data ?? []).map((v) => ({
      id: v.id,
      type: "visa" as const,
      title: v.visa_types?.name ?? "Visa application",
      subtitle: "Application",
      status: v.status,
      price: v.price,
      currency: v.currency,
      createdAt: v.created_at,
    })),
    ...(umrahRes.data ?? []).map((u) => ({
      id: u.id,
      type: "umrah" as const,
      title: u.umrah_packages?.name ?? "Umrah booking",
      subtitle: `${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`,
      status: u.status,
      price: u.total_price,
      currency: u.currency,
      createdAt: u.created_at,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return bookings;
}

/** Wallet snapshot + transaction history for the agent portal. */
export async function getAgencyWallet(agencyId: string) {
  const supabase = await createClient();
  const [{ data: agency }, { data: transactions }] = await Promise.all([
    supabase
      .from("agencies")
      .select("credit_balance, credit_limit")
      .eq("id", agencyId)
      .maybeSingle(),
    supabase
      .from("agency_wallet_transactions")
      .select("*, order:order_id (order_number)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const balance = Number(agency?.credit_balance ?? 0);
  const creditLimit = Number(agency?.credit_limit ?? 0);
  return {
    balance,
    creditLimit,
    available: balance + creditLimit,
    transactions: transactions ?? [],
  };
}

export type AgencyWalletTransaction = Awaited<
  ReturnType<typeof getAgencyWallet>
>["transactions"][number];

/** All-time outstanding balance — a lightweight count+sum, not the full nested-join getAgencyOrders. */
export async function getAgencyPendingPayments(agencyId: string): Promise<{ count: number; amount: number; currency: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("total, currency")
    .eq("agency_id", agencyId)
    .eq("status", "pending_payment");

  const rows = data ?? [];
  return {
    count: rows.length,
    amount: rows.reduce((sum, o) => sum + Number(o.total), 0),
    currency: rows[0]?.currency ?? "USD",
  };
}

/**
 * Commission ledger entries (earnings) with their order refs, newest first.
 * Optional filters power /agent/reports' date-range + product-type controls
 * — an order can in principle hold multiple item types, so the item_type
 * filter matches entries whose order contains AT LEAST ONE item of that
 * type, via an inner join through order_items (rather than dropping
 * multi-item orders from view entirely).
 */
export async function getAgencyCommissionEntries(
  agencyId: string,
  filters?: {
    from?: string;
    to?: string;
    itemType?: Database["public"]["Enums"]["order_item_type"];
  }
) {
  const supabase = await createClient();
  let query = supabase
    .from("agency_commission_entries")
    .select(
      filters?.itemType
        ? "*, order:order_id!inner (order_number, currency, created_at, order_items!inner(item_type))"
        : "*, order:order_id (order_number, currency, created_at, order_items(item_type))"
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);
  if (filters?.itemType) query = query.eq("order.order_items.item_type", filters.itemType);

  const { data } = await query;
  return data ?? [];
}

export type AgencyCommissionEntry = Awaited<
  ReturnType<typeof getAgencyCommissionEntries>
>[number];

/** Recorded commission payouts for an agency, newest first. */
export async function getAgencyCommissionPayouts(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_commission_payouts")
    .select("*")
    .eq("agency_id", agencyId)
    .order("paid_at", { ascending: false });
  return data ?? [];
}

export type AgencyCommissionPayout = Awaited<
  ReturnType<typeof getAgencyCommissionPayouts>
>[number];

/** Markup rules for an agency: one default (item_type null) + per-vertical overrides. */
export async function getAgencyMarkups(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_markups")
    .select("*")
    .eq("agency_id", agencyId)
    .order("item_type", { ascending: true, nullsFirst: true });
  return data ?? [];
}

/** Admin: every agency with member count (RLS admin policy grants the read). */
export async function getAllAgenciesForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agencies")
    .select("*, agency_members(count), agency_tiers(name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Admin: one agency with members for the detail console. */
export async function getAgencyForAdmin(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agencies")
    .select(
      "*, agency_members(id, role_in_agency, status, profiles(full_name, email)), agency_tiers(id, name, default_commission_rate, default_credit_limit)"
    )
    .eq("id", agencyId)
    .maybeSingle();
  return data;
}

/** Admin: all tiers, sorted for display, with how many agencies use each. */
export async function getAgencyTiers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_tiers")
    .select("*, agencies(count)")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export type AgencyTier = Awaited<ReturnType<typeof getAgencyTiers>>[number];

export type AgencyAgingBucket = "0-7" | "8-30" | "31-60" | "60+";

export type AgencyAgingRow = {
  agencyId: string;
  agencyName: string;
  contactEmail: string;
  outstandingAmount: number;
  agingSince: string;
  agingDays: number;
  bucket: AgencyAgingBucket;
};

function agingBucket(days: number): AgencyAgingBucket {
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  return "60+";
}

/**
 * There's no per-invoice due-date model here — wallet debt is the credit
 * exposure. For each agency currently negative, "aging" starts at the most
 * recent transaction where balance_after >= 0 (last time they were clean),
 * or at the agency's own creation if they've never been non-negative.
 */
export async function getAgencyAgingReport(): Promise<AgencyAgingRow[]> {
  const supabase = await createClient();

  const { data: agencies } = await supabase
    .from("agencies")
    .select("id, name, contact_email, credit_balance, created_at")
    .lt("credit_balance", 0);

  if (!agencies || agencies.length === 0) return [];

  const now = Date.now();

  const rows = await Promise.all(
    agencies.map(async (agency) => {
      const { data: lastClean } = await supabase
        .from("agency_wallet_transactions")
        .select("created_at")
        .eq("agency_id", agency.id)
        .gte("balance_after", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const agingSince = lastClean?.created_at ?? agency.created_at;
      const agingDays = Math.max(0, Math.floor((now - new Date(agingSince).getTime()) / 86_400_000));

      return {
        agencyId: agency.id,
        agencyName: agency.name,
        contactEmail: agency.contact_email,
        outstandingAmount: -Number(agency.credit_balance),
        agingSince,
        agingDays,
        bucket: agingBucket(agingDays),
      } satisfies AgencyAgingRow;
    })
  );

  return rows.sort((a, b) => b.agingDays - a.agingDays);
}

// Removed members are a soft-delete (status: "removed", never actually
// deleted — see removeTeamMember) so the row stays around for history, but
// this query is what feeds the current team roster, not an audit log.
// Excluding "removed" here also sidesteps profiles RLS: a removed member's
// profile is no longer visible to their former teammates, so an unfiltered
// query would show that row with a broken "?"/"—" placeholder forever.
export async function getAgencyTeam(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_members")
    .select("id, role_in_agency, status, created_at, profiles(full_name, email)")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .order("created_at");

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Agent dashboard — period-scoped KPIs (bookings/revenue/earned split with
// deltas + sparkline series), onboarding checklist, and a blended recent-
// activity feed. All strictly scoped to one agency_id, same isolation rule
// as the commission ledger above.
// ---------------------------------------------------------------------------

export type AgencyPeriodMetrics = {
  bookings: { current: number; previous: number; series: number[] };
  revenue: { current: number; previous: number; series: number[]; currency: string };
  earned: {
    current: number;
    previous: number;
    series: number[];
    markupEarned: number;
    commissionEarned: number;
  };
};

const PAID_ORDER_STATUSES = ["paid", "processing", "completed"];

export async function getAgencyPeriodMetrics(
  agencyId: string,
  range: { from: Date; to: Date; previousFrom: Date; previousTo: Date; granularity: "hour" | "day" | "week" }
): Promise<AgencyPeriodMetrics> {
  const supabase = await createClient();

  const [ordersCur, ordersPrev, entriesCur, entriesPrev] = await Promise.all([
    supabase
      .from("orders")
      .select("total, currency, status, created_at, order_items(id)")
      .eq("agency_id", agencyId)
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString()),
    supabase
      .from("orders")
      .select("total, status, created_at, order_items(id)")
      .eq("agency_id", agencyId)
      .gte("created_at", range.previousFrom.toISOString())
      .lte("created_at", range.previousTo.toISOString()),
    supabase
      .from("agency_commission_entries")
      .select("amount, commission_amount, markup_amount, status, created_at")
      .eq("agency_id", agencyId)
      .neq("status", "reversed")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString()),
    supabase
      .from("agency_commission_entries")
      .select("amount, status, created_at")
      .eq("agency_id", agencyId)
      .neq("status", "reversed")
      .gte("created_at", range.previousFrom.toISOString())
      .lte("created_at", range.previousTo.toISOString()),
  ]);

  const buckets = enumerateBuckets(range.from, range.to, range.granularity);
  const bucketIndex = new Map(buckets.map((b, i) => [b, i]));
  const bookingsSeries = new Array(buckets.length).fill(0);
  const revenueSeries = new Array(buckets.length).fill(0);
  const earnedSeries = new Array(buckets.length).fill(0);

  let bookingsCurrent = 0;
  let revenueCurrent = 0;
  let currency = "USD";
  for (const order of ordersCur.data ?? []) {
    const itemCount = order.order_items?.length ?? 0;
    bookingsCurrent += itemCount;
    const idx = bucketIndex.get(bucketKey(new Date(order.created_at), range.granularity));
    if (idx !== undefined) bookingsSeries[idx] += itemCount;
    if (PAID_ORDER_STATUSES.includes(order.status)) {
      revenueCurrent += Number(order.total);
      currency = order.currency ?? currency;
      if (idx !== undefined) revenueSeries[idx] += Number(order.total);
    }
  }

  let bookingsPrevious = 0;
  let revenuePrevious = 0;
  for (const order of ordersPrev.data ?? []) {
    bookingsPrevious += order.order_items?.length ?? 0;
    if (PAID_ORDER_STATUSES.includes(order.status)) revenuePrevious += Number(order.total);
  }

  let earnedCurrent = 0;
  let markupEarned = 0;
  let commissionEarned = 0;
  for (const entry of entriesCur.data ?? []) {
    earnedCurrent += Number(entry.amount);
    markupEarned += Number(entry.markup_amount);
    commissionEarned += Number(entry.commission_amount);
    const idx = bucketIndex.get(bucketKey(new Date(entry.created_at), range.granularity));
    if (idx !== undefined) earnedSeries[idx] += Number(entry.amount);
  }
  const earnedPrevious = (entriesPrev.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    bookings: { current: bookingsCurrent, previous: bookingsPrevious, series: bookingsSeries },
    revenue: {
      current: Math.round(revenueCurrent),
      previous: Math.round(revenuePrevious),
      series: revenueSeries,
      currency,
    },
    earned: {
      current: Math.round(earnedCurrent),
      previous: Math.round(earnedPrevious),
      series: earnedSeries,
      markupEarned: Math.round(markupEarned),
      commissionEarned: Math.round(commissionEarned),
    },
  };
}

export type AgencyOnboardingStatus = {
  hasFirstBooking: boolean;
  hasMarkupConfigured: boolean;
  hasInvitedTeamMember: boolean;
};

/** Drives the dashboard's "Getting started" checklist — hidden once all three are true. */
export async function getAgencyOnboardingStatus(agencyId: string): Promise<AgencyOnboardingStatus> {
  const supabase = await createClient();
  const [{ count: orderCount }, { count: markupCount }, { count: memberCount }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    supabase.from("agency_markups").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    supabase
      .from("agency_members")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "active"),
  ]);

  return {
    hasFirstBooking: (orderCount ?? 0) > 0,
    hasMarkupConfigured: (markupCount ?? 0) > 0,
    // > 1 because the owner's own row already counts as one active member.
    hasInvitedTeamMember: (memberCount ?? 0) > 1,
  };
}

/** Every invoice issued against this agency's orders — "My Invoices" list. RLS: can_access_order already covers active agency members. */
export async function getAgencyInvoices(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, order:order_id!inner (id, order_number, agency_id, currency)")
    .eq("order.agency_id", agencyId)
    .order("issued_at", { ascending: false, nullsFirst: false });
  return data ?? [];
}

export type AgencyInvoice = Awaited<ReturnType<typeof getAgencyInvoices>>[number];

/**
 * Credit or debit notes issued against this agency — a filtered slice of
 * the same wallet ledger getAgencyWallet reads, distinguished by their
 * auto-generated document_number (see 20260809000002_agency_account_center).
 */
export async function getAgencyWalletNotes(agencyId: string, kind: "credit_note" | "debit_note") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_wallet_transactions")
    .select("*, order:order_id (order_number)")
    .eq("agency_id", agencyId)
    .eq("type", kind)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type AgencyWalletNote = Awaited<ReturnType<typeof getAgencyWalletNotes>>[number];

/** This agency's refund requests, newest first — visible to any active member. */
export async function getAgencyRefundRequests(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_refund_requests")
    .select("*, order:order_id (order_number), requester:requested_by (full_name, email)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type AgencyRefundRequest = Awaited<ReturnType<typeof getAgencyRefundRequests>>[number];

/** Orders this agency could plausibly request a refund against — paid/processing/completed only. */
export async function getAgencyRefundableOrders(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, total, currency, status")
    .eq("agency_id", agencyId)
    .in("status", ["paid", "processing", "completed"])
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Admin: every pending refund request across all agencies, oldest first (a queue). */
export async function getPendingRefundRequestsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_refund_requests")
    .select("*, agency:agency_id (name, contact_email), order:order_id (order_number), requester:requested_by (full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Admin: recently reviewed (approved/rejected) refund requests, for context alongside the pending queue. */
export async function getRecentReviewedRefundRequestsForAdmin(limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_refund_requests")
    .select("*, agency:agency_id (name), order:order_id (order_number), requester:requested_by (full_name, email)")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * This agency's own hall bookings overlapping [from, to] — full detail
 * (customer, event name, guests), since RLS already scopes this to the
 * agency's own agency_id. For cross-agency "is this venue free" checks
 * without exposing another agency's data, see getVenueOccupiedRanges in
 * modules/events/queries.ts (get_venue_occupied_ranges RPC).
 */
export async function getAgencyHallBookingsInRange(agencyId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hall_bookings")
    .select(
      "id, venue_id, event_type, event_name, start_date, end_date, expected_guests, status, customer:customer_id (full_name, email), venue:venue_id (name)"
    )
    .eq("agency_id", agencyId)
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date", { ascending: true });
  return data ?? [];
}

export type AgencyHallBooking = Awaited<ReturnType<typeof getAgencyHallBookingsInRange>>[number];

export type AgencyActivityItem = {
  id: string;
  kind: "booking" | "wallet" | "payout";
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  createdAt: string;
  href: string;
};

const WALLET_TX_LABEL: Record<string, string> = {
  deposit: "Wallet top-up",
  booking_payment: "Booking payment",
  refund: "Wallet refund",
  adjustment: "Wallet adjustment",
};

/** Blended feed — recent bookings, wallet transactions, and commission payouts, newest first. Strictly scoped to one agency_id. */
export async function getAgencyRecentActivity(agencyId: string, limit = 10): Promise<AgencyActivityItem[]> {
  const supabase = await createClient();
  const [{ data: orders }, { data: walletTx }, { data: payouts }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, total, currency, status, created_at, order_items(id)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("agency_wallet_transactions")
      .select("id, type, amount, created_at")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("agency_commission_payouts")
      .select("id, amount, currency, method, paid_at")
      .eq("agency_id", agencyId)
      .order("paid_at", { ascending: false })
      .limit(limit),
  ]);

  const items: AgencyActivityItem[] = [
    ...(orders ?? []).map(
      (o): AgencyActivityItem => ({
        id: `order-${o.id}`,
        kind: "booking",
        title: `Order ${o.order_number}`,
        subtitle: `${o.order_items?.length ?? 0} item${o.order_items?.length === 1 ? "" : "s"} · ${o.status.replace(/_/g, " ")}`,
        amount: Number(o.total),
        currency: o.currency,
        createdAt: o.created_at,
        href: "/agent/bookings",
      })
    ),
    ...(walletTx ?? []).map(
      (t): AgencyActivityItem => ({
        id: `wallet-${t.id}`,
        kind: "wallet",
        title: WALLET_TX_LABEL[t.type] ?? "Wallet transaction",
        subtitle: Number(t.amount) >= 0 ? "Credited" : "Debited",
        amount: Number(t.amount),
        currency: "USD",
        createdAt: t.created_at,
        href: "/agent/wallet",
      })
    ),
    ...(payouts ?? []).map(
      (p): AgencyActivityItem => ({
        id: `payout-${p.id}`,
        kind: "payout",
        title: "Commission payout",
        subtitle: p.method ? `Paid via ${p.method}` : "Paid out",
        amount: Number(p.amount),
        currency: p.currency,
        createdAt: p.paid_at,
        href: "/agent/reports",
      })
    ),
  ];

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}
