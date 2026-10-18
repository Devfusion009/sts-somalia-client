import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { bucketLabel, enumerateBuckets, hourlyBucketKey, roundMoney } from "@/lib/date-range";
import { ADMIN_PAGE_SIZE, pageRange, searchTerm } from "@/lib/pagination";
import type { Database } from "@/lib/types/database.types";

/**
 * Headline totals. Users, the role split, order count and revenue are
 * aggregated by admin_dashboard_totals() in the database — summing row lists
 * here stopped counting at PostgREST's 1000-row cap.
 */
export async function getDashboardStats() {
  const supabase = await createClient();

  const [
    { data: totals },
    { count: pendingAgency },
    { count: pendingPartner },
    { count: pendingAffiliate },
    { count: pendingVenue },
  ] = await Promise.all([
    supabase.rpc("admin_dashboard_totals"),
    supabase.from("agency_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("hotel_partner_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("affiliate_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("venue_partner_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const raw = (totals ?? {}) as {
    usersByRole?: Record<string, number | string>;
    totalUsers?: number | string;
    totalOrders?: number | string;
    revenue?: number | string;
  };
  const usersByRole: Record<string, number> = {};
  for (const [role, n] of Object.entries(raw.usersByRole ?? {})) usersByRole[role] = Number(n);

  return {
    usersByRole,
    totalUsers: Number(raw.totalUsers ?? 0),
    totalOrders: Number(raw.totalOrders ?? 0),
    revenue: Number(raw.revenue ?? 0),
    pendingApplications: (pendingAgency ?? 0) + (pendingPartner ?? 0) + (pendingAffiliate ?? 0) + (pendingVenue ?? 0),
    pendingAgency: pendingAgency ?? 0,
    pendingPartner: pendingPartner ?? 0,
    pendingAffiliate: pendingAffiliate ?? 0,
    pendingVenue: pendingVenue ?? 0,
  };
}

export async function getPendingApplications() {
  const supabase = await createClient();

  const [agency, partner, affiliate] = await Promise.all([
    supabase
      .from("agency_applications")
      .select("id, agency_name, status, created_at, applicant:profiles!agency_applications_applicant_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("hotel_partner_applications")
      .select("id, business_name, status, created_at, applicant:profiles!hotel_partner_applications_applicant_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("affiliate_applications")
      .select("id, notes, status, created_at, applicant:profiles!affiliate_applications_applicant_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return {
    agency: agency.data ?? [],
    partner: partner.data ?? [],
    affiliate: affiliate.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Partner application review (queue with filters + per-type detail)
// ---------------------------------------------------------------------------
export type ApplicationQueueFilters = {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

const APPLICATION_NAME_COLUMN = {
  agency: "agency_name",
  hotel_partner: "business_name",
  affiliate: "reference_number", // affiliate has no business-name field; search falls back to ref/applicant
  venue_partner: "business_name",
} as const;

/**
 * Shared row shape across all three application types' queue listing —
 * supabase-js infers embedded-resource types by statically parsing the
 * `select()` string as a literal, which a template-interpolated select
 * (varying the FK constraint name per table) can't produce; it yields a
 * `ParserError` type instead of real columns. The query itself is correct
 * PostgREST (this genuinely works at runtime, identically across all three
 * tables), so rather than triplicate this filter logic into three literal
 * functions, the result is cast through `unknown` to an explicit shape
 * matching what every caller actually reads.
 */
export type ApplicationQueueRow = {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  reference_number: string | null;
  agency_name?: string;
  business_name?: string;
  notes?: string | null;
  applicant: { full_name: string | null; email: string; phone: string | null } | null;
  reviewer: { full_name: string | null; email: string } | null;
};

/** Never shows drafts — those are only ever visible to the applicant themselves. */
async function queryApplications(
  table: "agency_applications" | "hotel_partner_applications" | "affiliate_applications" | "venue_partner_applications",
  applicantFk: string,
  filters: ApplicationQueueFilters
): Promise<ApplicationQueueRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select(
      `*, applicant:profiles!${applicantFk}(full_name, email, phone), reviewer:profiles!${table}_assigned_reviewer_fkey(full_name, email)`
    )
    .neq("status", "draft");

  if (filters.status) query = query.eq("status", filters.status as never);
  // "Submitted between" filters the submitted_at column, not created_at — a
  // drafted-then-later-submitted application should match by when it was
  // actually submitted, matching the label and the "Submitted" table column.
  if (filters.dateFrom) query = query.gte("submitted_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("submitted_at", `${filters.dateTo}T23:59:59`);
  if (filters.search) {
    const nameCol =
      APPLICATION_NAME_COLUMN[
        table === "agency_applications"
          ? "agency"
          : table === "hotel_partner_applications"
            ? "hotel_partner"
            : table === "venue_partner_applications"
              ? "venue_partner"
              : "affiliate"
      ];
    query = query.or(`reference_number.ilike.%${filters.search}%,${nameCol}.ilike.%${filters.search}%`);
  }

  const { data } = await query.order("status", { ascending: true }).order("created_at", { ascending: false });
  return (data ?? []) as unknown as ApplicationQueueRow[];
}

export async function getApplicationsForAdmin(filters: ApplicationQueueFilters = {}) {
  const [agency, partner, affiliate, venue] = await Promise.all([
    queryApplications("agency_applications", "agency_applications_applicant_id_fkey", filters),
    queryApplications("hotel_partner_applications", "hotel_partner_applications_applicant_id_fkey", filters),
    queryApplications("affiliate_applications", "affiliate_applications_applicant_id_fkey", filters),
    queryApplications("venue_partner_applications", "venue_partner_applications_applicant_id_fkey", filters),
  ]);
  return { agency, partner, affiliate, venue };
}

export type ApplicationType = "agency" | "hotel_partner" | "affiliate" | "venue_partner";

const APPLICATION_TABLE: Record<
  ApplicationType,
  "agency_applications" | "hotel_partner_applications" | "affiliate_applications" | "venue_partner_applications"
> = {
  agency: "agency_applications",
  hotel_partner: "hotel_partner_applications",
  affiliate: "affiliate_applications",
  venue_partner: "venue_partner_applications",
};

/**
 * Supabase-js infers embedded-resource types by statically parsing the
 * `select()` string as a literal at the type level — a template-interpolated
 * select (varying the FK constraint name per application type) can't be
 * parsed that way and produces a `ParserError` type instead of real columns.
 * Three literal branches, one per type, keep each call properly typed.
 */
export async function getApplicationDetail(type: ApplicationType, id: string) {
  const supabase = await createClient();

  if (type === "agency") {
    const { data } = await supabase
      .from("agency_applications")
      .select(
        "*, applicant:profiles!agency_applications_applicant_id_fkey(full_name, email, phone), reviewer:profiles!agency_applications_assigned_reviewer_fkey(full_name, email)"
      )
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  if (type === "hotel_partner") {
    const { data } = await supabase
      .from("hotel_partner_applications")
      .select(
        "*, applicant:profiles!hotel_partner_applications_applicant_id_fkey(full_name, email, phone), reviewer:profiles!hotel_partner_applications_assigned_reviewer_fkey(full_name, email)"
      )
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  if (type === "venue_partner") {
    const { data } = await supabase
      .from("venue_partner_applications")
      .select(
        "*, applicant:profiles!venue_partner_applications_applicant_id_fkey(full_name, email, phone), reviewer:profiles!venue_partner_applications_assigned_reviewer_fkey(full_name, email)"
      )
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  const { data } = await supabase
    .from("affiliate_applications")
    .select(
      "*, applicant:profiles!affiliate_applications_applicant_id_fkey(full_name, email, phone), reviewer:profiles!affiliate_applications_assigned_reviewer_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getApplicationAuditTrail(type: ApplicationType, id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, old_data, new_data, created_at, actor:actor_id(full_name, email)")
    .eq("entity_type", APPLICATION_TABLE[type])
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Verification status for every uploaded document on an application, keyed by doc_key. */
export async function getDocumentReviews(type: ApplicationType, applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_document_reviews")
    .select("doc_key, status, note, reviewed_at, reviewer:reviewed_by(full_name, email)")
    .eq("application_type", type)
    .eq("application_id", applicationId);

  return new Map((data ?? []).map((row) => [row.doc_key, row]));
}

/** For the "assign reviewer" picker. */
export async function getAdminProfiles() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").eq("role", "admin").order("full_name");
  return data ?? [];
}

export type OrderQueueFilter = "all" | "action" | "upcoming" | Database["public"]["Enums"]["order_status"];

export type OrderQueue = {
  total: number;
  action: number;
  upcoming: number;
  byStatus: Record<string, number>;
  settledCount: number;
  settledRevenue: number;
  matching: number;
  ids: string[];
};

/**
 * Filter chip counts, stat tiles and the ids of one page of the Orders queue,
 * from admin_order_queue(). `today` is the local calendar date the "travelling
 * within 30 days" window starts from.
 */
export async function getOrderQueue(filter: OrderQueueFilter, page: number, today: string): Promise<OrderQueue> {
  const supabase = await createClient();
  const { from } = pageRange(page);
  const { data } = await supabase.rpc("admin_order_queue", {
    p_filter: filter,
    p_today: today,
    p_offset: from,
    p_limit: ADMIN_PAGE_SIZE,
  });
  const raw = (data ?? {}) as Partial<Record<keyof OrderQueue, unknown>>;
  const byStatus: Record<string, number> = {};
  for (const [status, n] of Object.entries((raw.byStatus ?? {}) as Record<string, number | string>)) byStatus[status] = Number(n);
  return {
    total: Number(raw.total ?? 0),
    action: Number(raw.action ?? 0),
    upcoming: Number(raw.upcoming ?? 0),
    byStatus,
    settledCount: Number(raw.settledCount ?? 0),
    settledRevenue: Number(raw.settledRevenue ?? 0),
    matching: Number(raw.matching ?? 0),
    ids: (raw.ids ?? []) as string[],
  };
}

/**
 * Every order, with what was actually booked and when the customer travels.
 *
 * order_items and their bookings were previously not selected at all, so the
 * admin table could show that someone paid USD 1180 on 11 August but not what
 * they bought or when they fly — the one thing an operator needs before they
 * can act on a payment. Each item type carries its dates on its own booking
 * row, so all five are joined; Umrah reaches one level further, to the
 * departure the booking is attached to.
 *
 * One unbroken literal: supabase-js parses this string statically to type the
 * embeds, and a concatenated one collapses to GenericStringError.
 */
export async function getOrdersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, subtotal, discount_total, total, created_at, paid_at, notes, customer:profiles!orders_customer_id_fkey(full_name, email, phone), agency:agencies(name), agency_customer:agency_customer_id(full_name, phone), payments(id, provider, method_label, amount, currency, status, payer_phone, created_at), invoices(invoice_number, status), order_items(id, item_type, quantity, total_price, hotel_booking:hotel_booking_id(check_in, check_out, num_rooms, num_adults, status, hotel:hotel_id(name, city)), flight_booking:flight_booking_id(origin_iata, destination_iata, depart_at, return_at, status), visa_application:visa_application_id(application_ref, status, travel_details, visa_type:visa_type_id(name, destination_country_code)), umrah_booking:umrah_booking_id(num_pilgrims, status, package:package_id(name, duration_days), departure:departure_id(departure_date, return_date)), hall_booking:hall_booking_id(event_type, start_date, end_date, status, venue:venue_id(name, city)))"
    )
    .in("id", ids);

  // `in` has no order of its own; keep the caller's (newest first) ordering.
  const position = new Map(ids.map((id, index) => [id, index]));
  return (data ?? []).sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

export type AdminOrder = Awaited<ReturnType<typeof getOrdersByIds>>[number];

export async function getVisaTypesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_types").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

/** Single visa type for the full-page editor at /admin/catalog/visa/[id]/edit. */
export async function getVisaTypeAdmin(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_types").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Application centres for the catalog and the booking forms. */
export async function getVisaCentresAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_application_centres")
    .select("*, visa_type_centres (visa_type_id)")
    .order("is_active", { ascending: false })
    .order("country_code")
    .order("name");
  return data ?? [];
}

export async function getVisaTypeCentreIds(visaTypeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_type_centres").select("centre_id").eq("visa_type_id", visaTypeId);
  return (data ?? []).map((r) => r.centre_id);
}

export async function getVisaNationalityRulesAdmin(visaTypeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_nationality_rules")
    .select("*")
    .eq("visa_type_id", visaTypeId)
    .order("nationality_code");
  return data ?? [];
}

export async function getUmrahPackagesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select("*, umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, price_override)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Full package config for the admin detail page — departures plus every child table added in 20260809000004. */
export async function getUmrahPackageById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select(
      `*,
       umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, offline_seats, price_override, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
       umrah_package_hotels(id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order),
       umrah_itinerary_days(id, day_number, title, description),
       umrah_package_pricing(id, sharing, price),
       umrah_package_agencies(agency_id)`
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Active agencies for the "local agencies" picker on the Umrah config page. */
export async function getActiveAgenciesForPicker() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agencies")
    .select("id, name, country_code, contact_email")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
};

export async function getRecentOrdersWithItems(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, total, created_at, customer:profiles!orders_customer_id_fkey(full_name, email), order_items(item_type)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/** All-time top hotels by confirmed+completed booking revenue (admin_top_hotels). */
export async function getTopHotels(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_top_hotels", { p_limit: limit });
  const rows = (data ?? []) as { name: string; city: string; bookings: number | string; revenue: number | string }[];
  return rows.map((row) => ({
    name: row.name,
    city: row.city,
    bookings: Number(row.bookings),
    revenue: Number(row.revenue),
  }));
}

// ---------------------------------------------------------------------------
// Visa application management
// ---------------------------------------------------------------------------

/**
 * Which workspace an application belongs in (manual or partner), plus its
 * processing attempts and staff notes. resolve_visa_processing_route is the
 * same function the ready-for-processing guard trigger calls, so the admin
 * page and the database can never disagree about the route.
 */
export async function getVisaProcessingWorkspace(applicationId: string, visaTypeId: string) {
  const supabase = await createClient();
  const [{ data: routeRows }, { data: jobs }, { data: notes }] = await Promise.all([
    supabase.rpc("resolve_visa_processing_route", { p_visa_type_id: visaTypeId }),
    supabase
      .from("visa_processing_jobs")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("visa_processing_notes")
      .select("*, author:profiles!visa_processing_notes_created_by_fkey (full_name)")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
  ]);
  const resolved = routeRows?.[0] ?? { route: "manual", provider_key: null };
  const route = resolved.route as "manual" | "partner";
  const manualJobs = (jobs ?? []).filter((j) => j.route === "manual");
  return {
    route,
    providerKey: resolved.provider_key,
    // The manual workspace renders regardless of route (it's the fallback
    // whenever a configured partner errors), so it only ever sees manual
    // attempts — a partner job's columns would be null in its fields anyway.
    manualActiveJob: manualJobs.find((j) => j.status === "active") ?? null,
    manualPastJobs: manualJobs.filter((j) => j.status !== "active"),
    notes: notes ?? [],
  };
}

export async function getVisaOrderAdmin(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select(
      "order:order_id (id, order_number, status, subtotal, markup_amount, fee_total, total, currency, payments(status, method_label, amount))"
    )
    .eq("visa_application_id", applicationId)
    .maybeSingle();
  const order = data?.order ?? null;
  if (!order) return null;

  const succeeded = order.payments.filter((p) => p.status === "succeeded");
  const paid = succeeded.reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    ...order,
    paid,
    remaining: Number(order.total) - paid,
    method: succeeded.at(-1)?.method_label ?? null,
  };
}

export async function getVisaStatsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_visa_status_counts");
  const byStatus: Record<string, number> = {};
  for (const [status, n] of Object.entries((data ?? {}) as Record<string, number | string>)) byStatus[status] = Number(n);
  return { total: Object.values(byStatus).reduce((sum, n) => sum + n, 0), byStatus };
}

// ---------------------------------------------------------------------------
// Events & halls management
// ---------------------------------------------------------------------------
export async function getVenuesAdmin({ q, status, city }: { q?: string; status?: string; city?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("event_venues")
    .select("*, property_links(label, url, sort_order)")
    .order("city", { ascending: true })
    .order("name", { ascending: true });

  const term = searchTerm(q);
  if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,tagline.ilike.%${term}%,address.ilike.%${term}%`);
  if (status) query = query.eq("status", status as Database["public"]["Enums"]["listing_status"]);
  if (city) query = query.eq("city", city);

  const { data } = await query;
  return data ?? [];
}

/** Every town with a venue, for the city filter; independent of the active filters. */
export async function getVenueCitiesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("event_venues").select("city, status");
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.city, (counts.get(row.city) ?? 0) + 1);
  return {
    cities: [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })),
    total: data?.length ?? 0,
    published: (data ?? []).filter((r) => r.status === "published").length,
  };
}

export async function getVenueByIdAdmin(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select(`*, property_links(label, url, sort_order), property_reviews(*)`)
    .eq("id", venueId)
    .maybeSingle();
  return data;
}

export async function getHallBookingsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hall_bookings")
    .select(
      "*, venue:venue_id(name, city), customer:profiles!hall_bookings_customer_id_fkey(full_name, email)"
    )
    .order("start_date", { ascending: true })
    .limit(300);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Hotel management (admin)
// ---------------------------------------------------------------------------
export type HotelListFilters = { page: number; q?: string; status?: string };

/**
 * One page of the hotels table: only the columns the table draws, the room
 * count as an aggregate (not every room id), filtered and sorted in the
 * database. `total` is the match count across all pages.
 */
export async function getHotelsAdmin({ page, q, status }: HotelListFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("hotels")
    .select("id, name, city, star_rating, status, booking_mode, partner:hotel_partners(name), hotel_rooms(count)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  const term = searchTerm(q);
  if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  if (status) query = query.eq("status", status as Database["public"]["Enums"]["listing_status"]);

  const { from, to } = pageRange(page);
  const { data, count } = await query.range(from, to);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getHotelByIdAdmin(hotelId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(
      `*,
       partner:hotel_partners(name, contact_email, contact_phone),
       hotel_rooms(*),
       property_links(label, url, sort_order),
       property_reviews(*)`
    )
    .eq("id", hotelId)
    .maybeSingle();
  if (!data) return null;

  // partner_accounts.id (the STS-HP-... reference) is what the console page
  // is keyed by — resolved separately since partner_accounts can't be a
  // real FK (it fans out across three different entity tables).
  let partnerAccountId: string | null = null;
  if (data.partner_id) {
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id")
      .eq("type", "hotel_partner")
      .eq("entity_id", data.partner_id)
      .maybeSingle();
    partnerAccountId = account?.id ?? null;
  }

  return { ...data, partnerAccountId };
}

/** Active hotel partners, for the "Owner" picker on the hotel create/edit form. */
export async function getHotelPartnersForSelect() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_partners")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

export async function getHotelRoomAdmin(roomId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("hotel_rooms").select("*, hotel:hotel_id(id, name)").eq("id", roomId).maybeSingle();
  return data;
}

export async function getHotelBookingsForHotel(hotelId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      `*,
       room:room_id(name),
       customer:profiles!hotel_bookings_customer_id_fkey(full_name, email),
       order_item:order_items(order:order_id(status))`
    )
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** "Upcoming" includes events already in progress (end_date hasn't passed yet), not just ones that haven't started. */
export async function getUpcomingHallBookings(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hall_bookings")
    .select("id, booking_ref, event_type, start_date, end_date, expected_guests, status, venue:venue_id(name)")
    .gte("end_date", new Date().toISOString().slice(0, 10))
    .in("status", ["pending", "confirmed"])
    .order("start_date", { ascending: true })
    .limit(limit);
  return data ?? [];
}

/**
 * Every account, with the facts needed to state its real roles.
 *
 * is_platform_admin and the membership rows are selected alongside `role`
 * because `role` on its own misrepresents the account: a platform admin whose
 * business role is still 'customer' is not a customer, and agency/hotel access
 * is granted by membership rows that `role` can fall out of step with.
 *
 * The memberships come back embedded in the same request rather than a query
 * per user — 500 accounts would otherwise be 1000 extra round trips. Ids are
 * selected instead of PostgREST's `count` aggregate because the generated
 * types can't describe an aggregate embed, and an account belongs to a handful
 * of organisations at most.
 */
export type UserListFilters = { page: number; q?: string };

/** One page of the users table, newest first, with membership counts as aggregates. */
export async function getUsersPage({ page, q }: UserListFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    // One unbroken literal: supabase-js infers embedded-resource types by
    // statically parsing this string, and a concatenated one yields
    // GenericStringError instead of real columns (same trap documented on
    // queryApplications above).
    .select(
      "id, full_name, email, role, is_platform_admin, status, created_at, agency_members(count), hotel_partner_members(count)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  const term = searchTerm(q);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const { from, to } = pageRange(page);
  const { data, count } = await query.range(from, to);

  const rows = (data ?? []).map((user) => ({
    ...user,
    agencyCount: user.agency_members?.[0]?.count ?? 0,
    hotelPartnerCount: user.hotel_partner_members?.[0]?.count ?? 0,
  }));
  return { rows, total: count ?? 0 };
}

/** Admin-only audit trail: every row-level change captured by the audit trigger. */
export async function getAuditLog(opts?: { entityType?: string; actorId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_data, new_data, created_at, actor:actor_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.entityType) query = query.eq("entity_type", opts.entityType);
  if (opts?.actorId) query = query.eq("actor_id", opts.actorId);
  const { data } = await query;
  return data ?? [];
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLog>>[number];

/** Distinct entity types currently present, for the filter dropdown. */
/** Every entity type in the audit log, for its filter (audit_log_entity_types reads the index, not the rows). */
export async function getAuditLogEntityTypes() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("audit_log_entity_types");
  return (data ?? []).map((r) => r.entity_type);
}

/** [orders, paid+completed count, paid+completed revenue, settled count, settled revenue, B2B count, B2B revenue] per hour. */
type OrderActivityHour = [number, number, number, number, number, number, number];

/**
 * Hourly order aggregates for a range (admin_order_activity). Memoized per
 * request: the stat cards, revenue chart and B2B split all read one range.
 */
const getOrderActivity = cache(async (fromIso: string, toIso: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_order_activity", { p_from: fromIso, p_to: toIso });
  const hours = (data ?? {}) as Record<string, (number | string)[]>;
  return Object.entries(hours).map(([hour, values]) => [hour, values.map(Number) as OrderActivityHour] as const);
});

const getSignupActivity = cache(async (fromIso: string, toIso: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_signup_activity", { p_from: fromIso, p_to: toIso });
  const raw = (data ?? {}) as { baseline?: number | string; buckets?: Record<string, number | string> };
  return {
    baseline: Number(raw.baseline ?? 0),
    hours: Object.entries(raw.buckets ?? {}).map(([hour, n]) => [hour, Number(n)] as const),
  };
});

// ---------------------------------------------------------------------------
// Date-range-aware dashboard additions (user growth, B2B/B2C split, agent
// leaderboard, stat-card comparisons, ranged revenue/bookings), aggregated by
// the admin_* functions in 20261018000002_dashboard_aggregates.sql.
// ---------------------------------------------------------------------------

/** Cumulative registered users over the range, bucketed by the caller's chosen granularity. */
export async function getUserGrowth(from: Date, to: Date, granularity: "hour" | "day" | "week") {
  const { baseline, hours } = await getSignupActivity(from.toISOString(), to.toISOString());

  const perBucket = new Map<string, number>();
  for (const [hour, n] of hours) {
    const key = hourlyBucketKey(hour, granularity);
    perBucket.set(key, (perBucket.get(key) ?? 0) + n);
  }

  let running = baseline;
  return enumerateBuckets(from, to, granularity).map((key) => {
    running += perBucket.get(key) ?? 0;
    return { bucket: key, label: bucketLabel(key, granularity), total: running };
  });
}

/** B2B (agency_id set) vs B2C order volume/revenue within the range, paid+completed only. */
export async function getB2BvsB2C(from: Date, to: Date) {
  const hours = await getOrderActivity(from.toISOString(), to.toISOString());
  const result = {
    b2b: { orders: 0, revenue: 0 },
    b2c: { orders: 0, revenue: 0 },
  };
  for (const [, [, paidOrders, paidRevenue, , , b2bOrders, b2bRevenue]] of hours) {
    result.b2b.orders += b2bOrders;
    result.b2b.revenue += b2bRevenue;
    result.b2c.orders += paidOrders - b2bOrders;
    result.b2c.revenue += paidRevenue - b2bRevenue;
  }
  return [
    { channel: "B2B", label: "Agencies", orders: result.b2b.orders, revenue: roundMoney(result.b2b.revenue) },
    { channel: "B2C", label: "Direct customers", orders: result.b2c.orders, revenue: roundMoney(result.b2c.revenue) },
  ];
}

/** Top agencies by revenue within the range, paid+completed only. */
export async function getAgentLeaderboard(from: Date, to: Date, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_agent_leaderboard", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_limit: limit,
  });
  const rows = (data ?? []) as { name: string; orders: number | string; revenue: number | string }[];
  return rows.map((row) => ({ name: row.name, orders: Number(row.orders), revenue: Math.round(Number(row.revenue)) }));
}

/** Revenue trend bucketed for an arbitrary date range (not just trailing months) — feeds the date-range-aware dashboard. */
export async function getRevenueTrendRanged(from: Date, to: Date, granularity: "hour" | "day" | "week") {
  const hours = await getOrderActivity(from.toISOString(), to.toISOString());

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (const key of enumerateBuckets(from, to, granularity)) buckets.set(key, { revenue: 0, orders: 0 });

  for (const [hour, [, , , settledOrders, settledRevenue]] of hours) {
    const bucket = buckets.get(hourlyBucketKey(hour, granularity));
    if (!bucket) continue;
    bucket.revenue += settledRevenue;
    bucket.orders += settledOrders;
  }

  return Array.from(buckets.entries()).map(([key, value]) => ({
    month: bucketLabel(key, granularity),
    revenue: roundMoney(value.revenue),
    orders: value.orders,
  }));
}

/** Bookings-by-type for an arbitrary date range. */
export async function getBookingsByTypeRanged(from: Date, to: Date) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_bookings_by_type", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  const counts: Record<string, number> = { hotel: 0, flight: 0, visa: 0, umrah: 0, hall: 0 };
  for (const [type, n] of Object.entries((data ?? {}) as Record<string, number | string>)) counts[type] = Number(n);

  return Object.entries(counts).map(([type, count]) => ({
    type,
    label: BOOKING_TYPE_LABELS[type] ?? type,
    count,
  }));
}

/** %-change comparisons + sparkline series for the 4 existing stat cards. */
export async function getStatCardTrends(
  from: Date,
  to: Date,
  previousFrom: Date,
  previousTo: Date,
  granularity: "hour" | "day" | "week"
) {
  const supabase = await createClient();

  const [signups, orders, previousOrders, { count: previousUsers }] = await Promise.all([
    getSignupActivity(from.toISOString(), to.toISOString()),
    getOrderActivity(from.toISOString(), to.toISOString()),
    getOrderActivity(previousFrom.toISOString(), previousTo.toISOString()),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", previousFrom.toISOString())
      .lte("created_at", previousTo.toISOString()),
  ]);

  const buckets = enumerateBuckets(from, to, granularity);
  const usersSeries = new Array(buckets.length).fill(0);
  const ordersSeries = new Array(buckets.length).fill(0);
  const revenueSeries = new Array(buckets.length).fill(0);
  const bucketIndex = new Map(buckets.map((b, i) => [b, i]));

  let usersCurrent = 0;
  for (const [hour, n] of signups.hours) {
    usersCurrent += n;
    const idx = bucketIndex.get(hourlyBucketKey(hour, granularity));
    if (idx !== undefined) usersSeries[idx] += n;
  }
  let ordersCurrent = 0;
  for (const [hour, [count, , paidRevenue]] of orders) {
    ordersCurrent += count;
    const idx = bucketIndex.get(hourlyBucketKey(hour, granularity));
    if (idx === undefined) continue;
    ordersSeries[idx] += count;
    revenueSeries[idx] += paidRevenue;
  }

  let ordersPrevious = 0;
  let revenuePrevious = 0;
  for (const [, [count, , paidRevenue]] of previousOrders) {
    ordersPrevious += count;
    revenuePrevious += paidRevenue;
  }

  return {
    users: { current: usersCurrent, previous: previousUsers ?? 0, series: usersSeries },
    orders: { current: ordersCurrent, previous: ordersPrevious, series: ordersSeries },
    revenue: { current: roundMoney(revenueSeries.reduce((a, b) => a + b, 0)), previous: roundMoney(revenuePrevious), series: revenueSeries },
  };
}
