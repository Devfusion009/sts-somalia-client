import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { enumerateBuckets, hourlyBucketKey, roundMoney } from "@/lib/date-range";
import { ADMIN_PAGE_SIZE, pageRange } from "@/lib/pagination";

/**
 * Agency orders with their items joined to every vertical — the same embed
 * shape as the checkout query so `describeOrderItem` from the payments
 * module can label items uniformly.
 */
/** Every order placed in one group submission from the desk. */
export async function getAgencyBatchOrders(agencyId: string, batchId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `*,
       agency_customer:agency_customer_id (id, full_name, phone),
       order_items (
         *,
         hotel_booking:hotel_booking_id (id, status, check_in, check_out, num_rooms, guest_details, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (id, num_pilgrims, booking_kind, status, package:package_id (name), custom_request:custom_request_id (reference, departure_date)),
         hall_booking:hall_booking_id (id, status, start_date, end_date, start_time, event_type, venue:venue_id (name, price_unit, base_price))
       ),
       payments (*)`
    )
    .eq("agency_id", agencyId)
    .eq("booking_batch_id", batchId)
    .order("created_at");
  return data ?? [];
}

/**
 * One order from the agency's own book — the desk's post-booking view. The
 * umrah embed carries the fulfillment-stage/departure fields the customer
 * account page uses (see modules/payments/queries.ts's getOrderForCheckout)
 * so this page can show the same progress timeline and flight details; the
 * list queries below don't need them and stay on the narrower shape.
 */
export async function getAgencyOrder(agencyId: string, orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `*,
       agency_customer:agency_customer_id (id, full_name, phone),
       order_items (
         *,
         hotel_booking:hotel_booking_id (id, status, check_in, check_out, num_rooms, guest_details, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (
           id, num_pilgrims, booking_kind, status, fulfillment_stage, room_sharing,
           package:package_id (name),
           custom_request:custom_request_id (reference, departure_date),
           departure:departure_id (
             departure_date, return_date,
             outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
             return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note
           )
         ),
         hall_booking:hall_booking_id (id, status, start_date, end_date, start_time, event_type, venue:venue_id (name, price_unit, base_price))
       ),
       payments (*)`
    )
    .eq("id", orderId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return data;
}

/**
 * One page of the agency's book, newest first, with only the fields the
 * bookings table draws. `type` narrows to orders holding at least one item of
 * that vertical through a second embed of order_items (filtered, then
 * required non-null — PostgREST's inner-join form), so the displayed
 * order_items still list every item on the order.
 */
export async function getAgencyOrders(
  agencyId: string,
  { page, type }: { page: number; type?: Database["public"]["Enums"]["order_item_type"] }
) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  let query = supabase
    .from("orders")
    .select(
      `id, order_number, status, total, currency, created_at, customer_id, booked_by,
       agency_customer:agency_customer_id (full_name, phone),
       payments (status, method_label),
       order_items (
         id, item_type,
         hotel_booking:hotel_booking_id (status, check_in, check_out, num_rooms, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (num_pilgrims, booking_kind, package:package_id (name), custom_request:custom_request_id (reference)),
         hall_booking:hall_booking_id (event_type, start_date, end_date, venue:venue_id (name))
       ),
       type_match:order_items (item_type)`,
      { count: "exact" }
    )
    .eq("agency_id", agencyId);
  if (type) query = query.eq("type_match.item_type", type).not("type_match", "is", null);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  return { orders: data ?? [], total: count ?? 0 };
}

/** Memoized per request: the agent layout and every agent page both resolve it. */
export const getMyAgency = cache(async (profileId: string) => {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("agency_members")
    .select(
      "id, agency_id, role_in_agency, username, agencies(id, agent_code, name, legal_name, registration_number, status, commission_rate, commission_rate_set_at, contact_email, contact_phone, country_code, credit_balance, credit_limit, logo_path, bank_name, bank_account_name, bank_account_number, bank_branch, bank_swift_code, about, website, address)"
    )
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership?.agencies) return null;

  return {
    agency: membership.agencies,
    roleInAgency: membership.role_in_agency,
    memberId: membership.id,
    username: membership.username,
  };
});

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

export type CommissionFilters = {
  from?: string;
  to?: string;
  itemType?: Database["public"]["Enums"]["order_item_type"];
};

/**
 * Commission ledger entries (earnings) with their order refs, newest first,
 * id as tie-breaker so pages and batches never overlap. Filters power
 * /agent/reports' date-range + product-type controls — an order can in
 * principle hold multiple item types, so the item_type filter matches entries
 * whose order contains AT LEAST ONE item of that type, via an inner join
 * through order_items (rather than dropping multi-item orders from view).
 */
function commissionEntriesQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  filters: CommissionFilters | undefined,
  count: boolean
) {
  let query = supabase
    .from("agency_commission_entries")
    .select(
      filters?.itemType
        ? "*, order:order_id!inner (order_number, currency, created_at, order_items!inner(item_type))"
        : "*, order:order_id (order_number, currency, created_at, order_items(item_type))",
      count ? { count: "exact" } : undefined
    )
    .eq("agency_id", agencyId);

  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);
  if (filters?.itemType) query = query.eq("order.order_items.item_type", filters.itemType);

  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
}

/** One page of commission entries for the reports and admin agency tables. */
export async function getAgencyCommissionEntries(agencyId: string, filters: CommissionFilters | undefined, page: number) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await commissionEntriesQuery(supabase, agencyId, filters, true).range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * Every matching entry, for the CSV export and PDF statement — read in
 * 1000-row batches (PostgREST's max_rows) so a long ledger is not cut off.
 */
export async function getAgencyCommissionLedger(agencyId: string, filters?: CommissionFilters) {
  const supabase = await createClient();
  const BATCH = 1000;
  const rows: AgencyCommissionEntry[] = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await commissionEntriesQuery(supabase, agencyId, filters, false).range(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

export type AgencyCommissionEntry = Awaited<ReturnType<typeof getAgencyCommissionEntries>>["rows"][number];

export type AgencyCommissionReport = {
  /** Entries matching the filters, reversed included. */
  entryCount: number;
  /** Non-reversed entries — "settled bookings". */
  earnedCount: number;
  earnedTotal: number;
  earnedThisMonth: number;
  months: { month: string; bookings: number; commission: number; markup: number; total: number }[];
};

/** Totals and the by-month breakdown for /agent/reports, from agency_commission_report(). */
export async function getAgencyCommissionReport(
  agencyId: string,
  filters?: CommissionFilters
): Promise<AgencyCommissionReport> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("agency_commission_report", {
    p_agency_id: agencyId,
    p_from: filters?.from,
    p_to: filters?.to,
    p_item_type: filters?.itemType,
  });
  const raw = (data ?? {}) as Partial<Record<keyof AgencyCommissionReport, unknown>>;
  const months = (raw.months ?? []) as Record<string, number | string>[];
  return {
    entryCount: Number(raw.entryCount ?? 0),
    earnedCount: Number(raw.earnedCount ?? 0),
    earnedTotal: Number(raw.earnedTotal ?? 0),
    earnedThisMonth: Number(raw.earnedThisMonth ?? 0),
    months: months.map((m) => ({
      month: String(m.month),
      bookings: Number(m.bookings),
      commission: Number(m.commission),
      markup: Number(m.markup),
      total: Number(m.total),
    })),
  };
}

/** Pending entries for the admin review list, newest first, capped at `limit`. */
export async function getAgencyPendingCommissionEntries(agencyId: string, limit = 200) {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("agency_commission_entries")
    .select("id, amount, created_at, order_id, order:order_id (order_number)", { count: "exact" })
    .eq("agency_id", agencyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  // Commission is approved only after the booking's last service date.
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const { data: ends } = orderIds.length
    ? await supabase.rpc("order_service_end_dates", { p_order_ids: orderIds })
    : { data: [] };
  const endByOrder = new Map((ends ?? []).map((e) => [e.order_id, e.end_date]));
  return {
    rows: rows.map((r) => ({ ...r, serviceEndsOn: endByOrder.get(r.order_id) ?? null })),
    total: count ?? 0,
  };
}

/** Recorded commission payouts for an agency, newest first; `limit` caps how many. */
export async function getAgencyCommissionPayouts(agencyId: string, limit?: number) {
  const supabase = await createClient();
  let query = supabase
    .from("agency_commission_payouts")
    .select("*")
    .eq("agency_id", agencyId)
    .order("paid_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return data ?? [];
}

export type AgencyCommissionPayout = Awaited<
  ReturnType<typeof getAgencyCommissionPayouts>
>[number];

export type AgencyEarningsSummary = {
  /** Everything ever earned that wasn't reversed — commission + markup. */
  totalEarned: number;
  /** Booked and paid, waiting on an STS review. */
  inReview: number;
  /** Approved by STS, before requests already in flight are netted out. */
  confirmed: number;
  /** Sitting in an open payout request. */
  requested: number;
  /** confirmed − requested: what a new payout request can draw on. */
  available: number;
  paidOut: number;
};

const EMPTY_EARNINGS: AgencyEarningsSummary = {
  totalEarned: 0,
  inReview: 0,
  confirmed: 0,
  requested: 0,
  available: 0,
  paidOut: 0,
};

/**
 * The six numbers behind the Finance Overview, from one RPC rather than a
 * client-side sum of the whole ledger — see agency_earnings_summary in
 * 20260902000001_agency_earnings_review_and_payouts.sql for why `available`
 * nets out in-flight requests.
 */
export async function getAgencyEarningsSummary(agencyId: string): Promise<AgencyEarningsSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("agency_earnings_summary", { target_agency_id: agencyId });
  if (!data) return EMPTY_EARNINGS;
  const raw = data as Record<keyof AgencyEarningsSummary, number | string>;
  return {
    totalEarned: Number(raw.totalEarned),
    inReview: Number(raw.inReview),
    confirmed: Number(raw.confirmed),
    requested: Number(raw.requested),
    available: Number(raw.available),
    paidOut: Number(raw.paidOut),
  };
}

export async function getAgencyPayoutRequests(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_payout_requests")
    .select(
      "*, requester:profiles!agency_payout_requests_requested_by_fkey(full_name, email), reviewer:profiles!agency_payout_requests_reviewed_by_fkey(full_name, email)"
    )
    .eq("agency_id", agencyId)
    .order("requested_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export type AgencyPayoutRequest = Awaited<ReturnType<typeof getAgencyPayoutRequests>>[number];

/** The buckets the admin withdrawals queue filters by, in workflow order. */
export const PAYOUT_QUEUE_FILTERS = {
  open: ["pending", "approved", "processing"],
  pending: ["pending"],
  approved: ["approved"],
  processing: ["processing"],
  paid: ["paid"],
  closed: ["rejected", "failed"],
} as const;

export type PayoutQueueFilter = keyof typeof PAYOUT_QUEUE_FILTERS;

/**
 * Every agency's requests in one queue — the admin working a payout run is
 * asking "who is owed money today", not "what does this one agency need",
 * which is the question getAgencyPayoutRequests answers on an agency page.
 */
export async function getPayoutQueue(filter: PayoutQueueFilter = "open") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_payout_requests")
    .select(
      "*, agency:agencies(id, name, bank_name, bank_account_name, bank_account_number, bank_branch, bank_swift_code), requester:profiles!agency_payout_requests_requested_by_fkey(full_name, email), reviewer:profiles!agency_payout_requests_reviewed_by_fkey(full_name, email)"
    )
    .in("status", [...PAYOUT_QUEUE_FILTERS[filter]])
    .order("requested_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export type PayoutQueueRow = Awaited<ReturnType<typeof getPayoutQueue>>[number];

export type PayoutQueueTotals = {
  toReviewCount: number;
  toReviewAmount: number;
  toPayCount: number;
  toPayAmount: number;
  inTransitCount: number;
  inTransitAmount: number;
  paidThisMonth: number;
};

const EMPTY_PAYOUT_TOTALS: PayoutQueueTotals = {
  toReviewCount: 0,
  toReviewAmount: 0,
  toPayCount: 0,
  toPayAmount: 0,
  inTransitCount: 0,
  inTransitAmount: 0,
  paidThisMonth: 0,
};

export async function getPayoutQueueTotals(): Promise<PayoutQueueTotals> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_payout_queue_totals");
  if (!data) return EMPTY_PAYOUT_TOTALS;
  const raw = data as Record<keyof PayoutQueueTotals, number | string>;
  return {
    toReviewCount: Number(raw.toReviewCount),
    toReviewAmount: Number(raw.toReviewAmount),
    toPayCount: Number(raw.toPayCount),
    toPayAmount: Number(raw.toPayAmount),
    inTransitCount: Number(raw.inTransitCount),
    inTransitAmount: Number(raw.inTransitAmount),
    paidThisMonth: Number(raw.paidThisMonth),
  };
}

export async function getAgencyTopupRequests(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_topup_requests")
    .select(
      "*, requester:profiles!agency_topup_requests_requested_by_fkey(full_name, email), reviewer:profiles!agency_topup_requests_reviewed_by_fkey(full_name, email)"
    )
    .eq("agency_id", agencyId)
    .order("requested_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export type AgencyTopupRequest = Awaited<ReturnType<typeof getAgencyTopupRequests>>[number];

/** The buckets the admin top-ups queue filters by. */
export const TOPUP_QUEUE_FILTERS = {
  pending: ["pending"],
  approved: ["approved"],
  declined: ["rejected", "cancelled", "failed"],
} as const;

export type TopupQueueFilter = keyof typeof TOPUP_QUEUE_FILTERS | "all";

/**
 * Every agency's top-up requests in one queue — an admin confirming money
 * sent today is asking "who sent us money", not "what does this one agency
 * need", which is the question getAgencyTopupRequests answers on an agency
 * page.
 */
export async function getTopupQueue(filter: TopupQueueFilter = "pending") {
  const supabase = await createClient();
  let query = supabase
    .from("agency_topup_requests")
    .select(
      "*, agency:agencies(id, name), requester:profiles!agency_topup_requests_requested_by_fkey(full_name, email)"
    )
    .order("requested_at", { ascending: false })
    .limit(100);
  if (filter !== "all") {
    query = query.in("status", [...TOPUP_QUEUE_FILTERS[filter]]);
  }
  const { data } = await query;
  return data ?? [];
}

export type TopupQueueRow = Awaited<ReturnType<typeof getTopupQueue>>[number];

export type TopupQueueTotals = {
  toReviewCount: number;
  toReviewAmount: number;
  creditedThisMonth: number;
  declinedCount: number;
};

/**
 * Simple aggregates over a table small enough not to need its own RPC (the
 * payouts queue's admin_payout_queue_totals exists because that table also
 * tracks multi-stage transit; top-ups only ever go pending → one decision).
 */
export async function getTopupQueueTotals(): Promise<TopupQueueTotals> {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [{ data: pending }, { data: approved }, { count: declinedCount }] = await Promise.all([
    supabase.from("agency_topup_requests").select("amount").eq("status", "pending"),
    supabase
      .from("agency_topup_requests")
      .select("amount")
      .eq("status", "approved")
      .gte("reviewed_at", startOfMonth.toISOString()),
    supabase
      .from("agency_topup_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["rejected", "failed"]),
  ]);

  return {
    toReviewCount: pending?.length ?? 0,
    toReviewAmount: (pending ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
    creditedThisMonth: (approved ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
    declinedCount: declinedCount ?? 0,
  };
}

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

/**
 * Markup change requests for one agency, newest first — read by both the
 * agent portal (members policy) and the admin agency page (admin policy).
 * Both FKs to profiles are named explicitly: an unqualified profiles join is
 * ambiguous (PGRST201) and silently returns nothing.
 */
export async function getAgencyMarkupRequests(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_markup_requests")
    .select(
      "*, requester:profiles!agency_markup_requests_requested_by_fkey(full_name, email), reviewer:profiles!agency_markup_requests_reviewed_by_fkey(full_name, email)"
    )
    .eq("agency_id", agencyId)
    .order("requested_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export type AgencyMarkupRequest = Awaited<ReturnType<typeof getAgencyMarkupRequests>>[number];

/**
 * Admin: every pending markup request across all agencies (newest first),
 * plus the live rule each one would replace, keyed `${agency_id}:${scope}`
 * — the approval queue on /admin/agencies.
 */
export async function getPendingMarkupRequestsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_markup_requests")
    .select("*, agency:agencies(id, name), requester:profiles!agency_markup_requests_requested_by_fkey(full_name, email)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  const requests = data ?? [];

  const currentRules = new Map<string, { markup_type: string; value: number }>();
  const agencyIds = [...new Set(requests.map((r) => r.agency_id))];
  if (agencyIds.length > 0) {
    const { data: rules } = await supabase
      .from("agency_markups")
      .select("agency_id, item_type, markup_type, value")
      .in("agency_id", agencyIds);
    for (const rule of rules ?? []) {
      currentRules.set(`${rule.agency_id}:${rule.item_type ?? "all"}`, { markup_type: rule.markup_type, value: rule.value });
    }
  }
  return { requests, currentRules };
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
      "*, agency_members(id, role_in_agency, status, username, profiles(full_name, email)), agency_tiers(id, name, default_commission_rate, default_credit_limit)"
    )
    .eq("id", agencyId)
    .maybeSingle();
  return data;
}

/** Admin: how many clients this agency's book holds (and how many hold an STS account). */
export async function getAgencyCustomerCounts(agencyId: string) {
  const supabase = await createClient();
  const [{ count: total }, { count: registered }] = await Promise.all([
    supabase
      .from("agency_customers")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId),
    supabase
      .from("agency_customers")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .not("profile_id", "is", null),
  ]);
  return { total: total ?? 0, registered: registered ?? 0 };
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
    .select("id, role_in_agency, status, created_at, username, profiles(full_name, email)")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .order("created_at");

  return data ?? [];
}

/** Request-scoped so the dashboard header and checklist share one count. */
export const getAgencyTeamCount = cache(async (agencyId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId).eq("status", "active");
  if (error) throw error;
  return count ?? 0;
});

// ---------------------------------------------------------------------------
// Agent dashboard — period-scoped KPIs (bookings/revenue/earned split with
// deltas + sparkline series), onboarding checklist, and a blended recent-
// activity feed. All strictly scoped to one agency_id, same isolation rule
// as the commission ledger above.
// ---------------------------------------------------------------------------

export type AgencyPeriodMetrics = {
  /** Bucket keys for the series arrays — label with bucketLabel() at render time. */
  buckets: string[];
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

/** [order items booked, settled revenue, earned, markup earned, commission earned] per hour. */
type AgencyActivityHour = [number, number, number, number, number];

async function getAgencyActivity(agencyId: string, from: Date, to: Date) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("agency_period_activity", {
    p_agency_id: agencyId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  const raw = (data ?? {}) as { buckets?: Record<string, (number | string)[]>; currency?: string | null };
  return {
    hours: Object.entries(raw.buckets ?? {}).map(([hour, values]) => [hour, values.map(Number) as AgencyActivityHour] as const),
    currency: raw.currency ?? null,
  };
}

/** Bookings, revenue and earnings for a period and the one before it, from agency_period_activity(). */
export async function getAgencyPeriodMetrics(
  agencyId: string,
  range: { from: Date; to: Date; previousFrom: Date; previousTo: Date; granularity: "hour" | "day" | "week" }
): Promise<AgencyPeriodMetrics> {
  const [current, previous] = await Promise.all([
    getAgencyActivity(agencyId, range.from, range.to),
    getAgencyActivity(agencyId, range.previousFrom, range.previousTo),
  ]);

  const buckets = enumerateBuckets(range.from, range.to, range.granularity);
  const bucketIndex = new Map(buckets.map((b, i) => [b, i]));
  const bookingsSeries = new Array(buckets.length).fill(0);
  const revenueSeries = new Array(buckets.length).fill(0);
  const earnedSeries = new Array(buckets.length).fill(0);

  let bookingsCurrent = 0;
  let revenueCurrent = 0;
  let earnedCurrent = 0;
  let markupEarned = 0;
  let commissionEarned = 0;
  for (const [hour, [items, revenue, earned, markup, commission]] of current.hours) {
    bookingsCurrent += items;
    revenueCurrent += revenue;
    earnedCurrent += earned;
    markupEarned += markup;
    commissionEarned += commission;
    const idx = bucketIndex.get(hourlyBucketKey(hour, range.granularity));
    if (idx === undefined) continue;
    bookingsSeries[idx] += items;
    revenueSeries[idx] += revenue;
    earnedSeries[idx] += earned;
  }

  let bookingsPrevious = 0;
  let revenuePrevious = 0;
  let earnedPrevious = 0;
  for (const [, [items, revenue, earned]] of previous.hours) {
    bookingsPrevious += items;
    revenuePrevious += revenue;
    earnedPrevious += earned;
  }

  return {
    buckets,
    bookings: { current: bookingsCurrent, previous: bookingsPrevious, series: bookingsSeries },
    revenue: {
      current: roundMoney(revenueCurrent),
      previous: roundMoney(revenuePrevious),
      series: revenueSeries,
      currency: current.currency ?? "USD",
    },
    earned: {
      current: roundMoney(earnedCurrent),
      previous: roundMoney(earnedPrevious),
      series: earnedSeries,
      markupEarned: roundMoney(markupEarned),
      commissionEarned: roundMoney(commissionEarned),
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
  const [{ data: orders }, { data: markups }, memberCount] = await Promise.all([
    supabase.from("orders").select("id").eq("agency_id", agencyId).limit(1),
    supabase.from("agency_markups").select("id").eq("agency_id", agencyId).limit(1),
    getAgencyTeamCount(agencyId),
  ]);

  return {
    hasFirstBooking: Boolean(orders?.length),
    hasMarkupConfigured: Boolean(markups?.length),
    hasInvitedTeamMember: memberCount > 1,
  };
}

/** One page of invoices issued against this agency's orders — "My Invoices". RLS: can_access_order already covers active agency members. */
export async function getAgencyInvoices(agencyId: string, page: number) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await supabase
    .from("invoices")
    .select("*, order:order_id!inner (id, order_number, agency_id, currency)", { count: "exact" })
    .eq("order.agency_id", agencyId)
    .order("issued_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

export type AgencyInvoice = Awaited<ReturnType<typeof getAgencyInvoices>>["rows"][number];

/**
 * One page of credit or debit notes issued against this agency — a filtered
 * slice of the same wallet ledger getAgencyWallet reads, distinguished by
 * their auto-generated document_number (see 20260809000002_agency_account_center).
 */
export async function getAgencyWalletNotes(agencyId: string, kind: "credit_note" | "debit_note", page: number) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await supabase
    .from("agency_wallet_transactions")
    .select("*, order:order_id (order_number)", { count: "exact" })
    .eq("agency_id", agencyId)
    .eq("type", kind)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

/** One page of the full wallet ledger, newest first — Billing's Statement tab. */
export async function getAgencyStatement(agencyId: string, page: number) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await supabase
    .from("agency_wallet_transactions")
    .select("*, order:order_id (order_number)", { count: "exact" })
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * The whole wallet ledger for the CSV export, read in 1000-row batches —
 * PostgREST's max_rows — so a long history is not cut off.
 */
export async function getAgencyWalletLedger(agencyId: string) {
  const supabase = await createClient();
  const BATCH = 1000;
  const rows = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase
      .from("agency_wallet_transactions")
      .select("created_at, type, document_number, note, amount, balance_after, order:order_id (order_number)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

export type AgencyWalletNote = Awaited<ReturnType<typeof getAgencyWalletNotes>>["rows"][number];

/** One page of this agency's refund requests, newest first — visible to any active member. */
export async function getAgencyRefundRequests(agencyId: string, page: number) {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await supabase
    .from("agency_refund_requests")
    .select("*, order:order_id (order_number), requester:requested_by (full_name, email)", { count: "exact" })
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

export type AgencyRefundRequest = Awaited<ReturnType<typeof getAgencyRefundRequests>>["rows"][number];

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

/** Admin: every pending refund request across all agencies, newest first. */
export async function getPendingRefundRequestsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_refund_requests")
    .select("*, agency:agency_id (name, contact_email), order:order_id (order_number), requester:requested_by (full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
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
      .select("id, type, amount, note, created_at")
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
        title:
          t.type === "deposit" && t.note === "Approved earnings transfer"
            ? "Earnings transfer"
            : (WALLET_TX_LABEL[t.type] ?? "Wallet transaction"),
        subtitle: Number(t.amount) >= 0 ? "Credited" : "Debited",
        amount: Number(t.amount),
        currency: "USD",
        createdAt: t.created_at,
        href: "/agent/finance/transactions",
      })
    ),
    // Wallet transfers already appear as their wallet credit.
    ...(payouts ?? []).filter((p) => p.method !== "wallet").map(
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

// ---------------------------------------------------------------------------
// Customer book — the agency's clients with their booking history. Rows link
// to the registered B2C account behind the same email (profile_id, maintained
// by DB triggers) so the agent can see which clients hold an STS account.
// ---------------------------------------------------------------------------

export type AgencyCustomerWithStats = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  profile_id: string | null;
  created_at: string;
  bookings: number;
  spent: number;
  currency: string;
  lastBookingAt: string | null;
};

/**
 * One page of the agency's clients with their booking totals, from
 * agency_customer_page(). `sort: "recent"` puts the most recently booked first.
 */
export async function getAgencyCustomersWithStats(
  agencyId: string,
  { search, page, sort = "name" }: { search?: string; page: number; sort?: "name" | "recent" }
): Promise<{ customers: AgencyCustomerWithStats[]; total: number; registered: number }> {
  const supabase = await createClient();
  const { from } = pageRange(page);
  const { data } = await supabase.rpc("agency_customer_page", {
    p_agency_id: agencyId,
    p_search: search?.trim() ?? "",
    p_sort: sort,
    p_offset: from,
    p_limit: ADMIN_PAGE_SIZE,
  });
  const raw = (data ?? {}) as {
    total?: number | string;
    registered?: number | string;
    rows?: (Omit<AgencyCustomerWithStats, "bookings" | "spent" | "currency"> & {
      bookings: number | string;
      spent: number | string;
      currency: string | null;
    })[];
  };
  return {
    total: Number(raw.total ?? 0),
    registered: Number(raw.registered ?? 0),
    customers: (raw.rows ?? []).map((c) => ({
      ...c,
      bookings: Number(c.bookings),
      spent: Math.round(Number(c.spent)),
      currency: c.currency ?? "USD",
    })),
  };
}

/**
 * One client with their full history: every order the agency placed for
 * them (labelled per vertical) plus flight quote requests, which have no
 * order until STS staff finalize one.
 */
export async function getAgencyCustomerDetail(agencyId: string, customerId: string) {
  const supabase = await createClient();
  const [{ data: customer }, { data: orders }, { data: flightQuotes }] = await Promise.all([
    supabase
      .from("agency_customers")
      .select("id, full_name, email, phone, notes, profile_id, created_at, created_by")
      .eq("agency_id", agencyId)
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, total, currency, created_at, order_items(item_type)")
      .eq("agency_id", agencyId)
      .eq("agency_customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("flight_bookings")
      .select("id, origin_iata, destination_iata, depart_at, return_at, status, created_at")
      .eq("agency_id", agencyId)
      .eq("agency_customer_id", customerId)
      .eq("provider", "quote_request")
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) return null;
  return { customer, orders: orders ?? [], flightQuotes: flightQuotes ?? [] };
}

export type AgencyCustomerDetail = NonNullable<Awaited<ReturnType<typeof getAgencyCustomerDetail>>>;
