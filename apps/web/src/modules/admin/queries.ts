import "server-only";
import { createClient } from "@/lib/supabase/server";
import { bucketKey, bucketLabel, enumerateBuckets } from "@/lib/date-range";

export async function getDashboardStats() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { count: totalOrders },
    { data: paidOrders },
    { count: pendingAgency },
    { count: pendingPartner },
    { count: pendingAffiliate },
    { count: pendingVenue },
  ] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total").in("status", ["paid", "completed"]),
    supabase.from("agency_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("hotel_partner_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("affiliate_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("venue_partner_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const usersByRole: Record<string, number> = {};
  for (const p of profiles ?? []) {
    usersByRole[p.role] = (usersByRole[p.role] ?? 0) + 1;
  }

  const revenue = (paidOrders ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  return {
    usersByRole,
    totalUsers: profiles?.length ?? 0,
    totalOrders: totalOrders ?? 0,
    revenue,
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
      .order("created_at", { ascending: true }),
    supabase
      .from("hotel_partner_applications")
      .select("id, business_name, status, created_at, applicant:profiles!hotel_partner_applications_applicant_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("affiliate_applications")
      .select("id, notes, status, created_at, applicant:profiles!affiliate_applications_applicant_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
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

  const { data } = await query.order("status", { ascending: true }).order("created_at", { ascending: true });
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
export async function getAllOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, subtotal, discount_total, total, created_at, paid_at, notes, customer:profiles!orders_customer_id_fkey(full_name, email, phone), agency:agencies(name), payments(id, provider, method_label, amount, currency, status, payer_phone, created_at), invoices(invoice_number, status), order_items(id, item_type, quantity, total_price, hotel_booking:hotel_booking_id(check_in, check_out, num_rooms, num_adults, status, hotel:hotel_id(name, city)), flight_booking:flight_booking_id(origin_iata, destination_iata, depart_at, return_at, status), visa_application:visa_application_id(application_ref, status, travel_details, visa_type:visa_type_id(name, destination_country_code)), umrah_booking:umrah_booking_id(num_pilgrims, status, package:package_id(name, duration_days), departure:departure_id(departure_date, return_date)), hall_booking:hall_booking_id(event_type, start_date, end_date, status, venue:venue_id(name, city)))"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return data ?? [];
}

export type AdminOrder = Awaited<ReturnType<typeof getAllOrders>>[number];

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
       umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, price_override),
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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getRevenueTrend(months = 6) {
  const supabase = await createClient();

  const cutoff = new Date();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - (months - 1));
  cutoff.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("orders")
    .select("total, status, created_at")
    .in("status", ["paid", "processing", "completed"])
    .gte("created_at", cutoff.toISOString());

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(cutoff);
    d.setMonth(d.getMonth() + i);
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { revenue: 0, orders: 0 });
  }

  for (const order of data ?? []) {
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(order.total);
    bucket.orders += 1;
  }

  return Array.from(buckets.entries()).map(([key, value]) => {
    const [, month] = key.split("-").map(Number);
    return { month: MONTH_LABELS[month], revenue: Math.round(value.revenue), orders: value.orders };
  });
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
};

export async function getBookingsByType() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("item_type, orders!inner(status)")
    .in("orders.status", ["paid", "processing", "completed"]);

  const counts: Record<string, number> = { hotel: 0, flight: 0, visa: 0, umrah: 0 };
  for (const item of data ?? []) {
    counts[item.item_type] = (counts[item.item_type] ?? 0) + 1;
  }

  return Object.entries(counts).map(([type, count]) => ({
    type,
    label: BOOKING_TYPE_LABELS[type] ?? type,
    count,
  }));
}

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

export async function getTopHotels(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_bookings")
    .select("hotel_id, total_price, status, hotels(name, city)")
    .in("status", ["confirmed", "completed"]);

  const byHotel = new Map<string, { name: string; city: string; bookings: number; revenue: number }>();
  for (const booking of data ?? []) {
    const hotel = booking.hotels as unknown as { name: string; city: string } | null;
    if (!hotel) continue;
    const existing = byHotel.get(booking.hotel_id) ?? { name: hotel.name, city: hotel.city, bookings: 0, revenue: 0 };
    existing.bookings += 1;
    existing.revenue += Number(booking.total_price);
    byHotel.set(booking.hotel_id, existing);
  }

  return Array.from(byHotel.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Visa application management
// ---------------------------------------------------------------------------
export async function getVisaApplicationsAdmin(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("visa_applications")
    .select(
      "id, application_ref, applicant_type, status, price, currency, created_at, traveler_details, visa_type:visa_type_id(name, destination_country_code)"
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status as never);
  const { data } = await query;
  return data ?? [];
}

export async function getVisaApplicationAdmin(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select(
      `*,
       visa_type:visa_type_id (*),
       submitter:profiles!visa_applications_submitted_by_fkey (full_name, email),
       members:visa_members (*),
       documents:visa_documents (*),
       history:visa_application_status_history (*),
       document_requests:visa_document_requests (*)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  data.members.sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  data.history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  data.document_requests.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return data;
}

export async function getVisaOrderAdmin(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("order:order_id (id, order_number, status, total, currency)")
    .eq("visa_application_id", applicationId)
    .maybeSingle();
  return data?.order ?? null;
}

export async function getVisaStatsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_applications").select("status").neq("status", "draft");
  const byStatus: Record<string, number> = {};
  for (const row of data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  return { total: data?.length ?? 0, byStatus };
}

// ---------------------------------------------------------------------------
// Events & halls management
// ---------------------------------------------------------------------------
export async function getVenuesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_venues")
    .select("*, property_links(label, url, sort_order)")
    .order("created_at", { ascending: false });
  return data ?? [];
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
export async function getHotelsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select("*, hotel_rooms(id), partner:hotel_partners(name)")
    .order("created_at", { ascending: false });
  return data ?? [];
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

export async function getRoomInventoryAdmin(roomId: string, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_room_inventory")
    .select("*")
    .eq("room_id", roomId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });
  return data ?? [];
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
export async function getAllUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    // One unbroken literal: supabase-js infers embedded-resource types by
    // statically parsing this string, and a concatenated one yields
    // GenericStringError instead of real columns (same trap documented on
    // queryApplications above).
    .select(
      "id, full_name, email, role, is_platform_admin, status, created_at, agency_members(id), hotel_partner_members(id)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (data ?? []).map((user) => ({
    ...user,
    agencyCount: user.agency_members?.length ?? 0,
    hotelPartnerCount: user.hotel_partner_members?.length ?? 0,
  }));
}

/** Admin-only audit trail: every row-level change captured by the audit trigger. */
export async function getAuditLog(opts?: { entityType?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_data, new_data, created_at, actor:actor_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.entityType) query = query.eq("entity_type", opts.entityType);
  const { data } = await query;
  return data ?? [];
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLog>>[number];

/** Distinct entity types currently present, for the filter dropdown. */
export async function getAuditLogEntityTypes() {
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("entity_type").limit(2000);
  return Array.from(new Set((data ?? []).map((r) => r.entity_type))).sort();
}

// ---------------------------------------------------------------------------
// Date-range-aware dashboard additions (user growth, B2B/B2C split, agent
// leaderboard, stat-card comparisons, ranged revenue/bookings). Kept as new
// functions rather than changing the signatures of the existing
// getRevenueTrend/getBookingsByType above, so nothing already calling those
// with no arguments is affected.
// ---------------------------------------------------------------------------

/** Cumulative registered users over the range, bucketed by the caller's chosen granularity. */
export async function getUserGrowth(from: Date, to: Date, granularity: "hour" | "day" | "week") {
  const supabase = await createClient();

  const [{ count: baseline }, { data: inRange }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).lt("created_at", from.toISOString()),
    supabase.from("profiles").select("created_at").gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
  ]);

  const perBucket = new Map<string, number>();
  for (const row of inRange ?? []) {
    const key = bucketKey(new Date(row.created_at), granularity);
    perBucket.set(key, (perBucket.get(key) ?? 0) + 1);
  }

  let running = baseline ?? 0;
  return enumerateBuckets(from, to, granularity).map((key) => {
    running += perBucket.get(key) ?? 0;
    return { bucket: key, label: bucketLabel(key, granularity), total: running };
  });
}

/** B2B (agency_id set) vs B2C order volume/revenue within the range, paid+completed only. */
export async function getB2BvsB2C(from: Date, to: Date) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("agency_id, total, status, created_at")
    .in("status", ["paid", "completed"])
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const result = {
    b2b: { orders: 0, revenue: 0 },
    b2c: { orders: 0, revenue: 0 },
  };
  for (const order of data ?? []) {
    const bucket = order.agency_id ? result.b2b : result.b2c;
    bucket.orders += 1;
    bucket.revenue += Number(order.total);
  }
  return [
    { channel: "B2B", label: "Agencies", orders: result.b2b.orders, revenue: Math.round(result.b2b.revenue) },
    { channel: "B2C", label: "Direct customers", orders: result.b2c.orders, revenue: Math.round(result.b2c.revenue) },
  ];
}

/** Top agencies by revenue within the range, paid+completed only. */
export async function getAgentLeaderboard(from: Date, to: Date, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("agency_id, total, status, created_at, agencies(name)")
    .in("status", ["paid", "completed"])
    .not("agency_id", "is", null)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const byAgency = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const order of data ?? []) {
    if (!order.agency_id) continue;
    const agency = order.agencies as unknown as { name: string } | null;
    const existing = byAgency.get(order.agency_id) ?? { name: agency?.name ?? "—", orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += Number(order.total);
    byAgency.set(order.agency_id, existing);
  }

  return Array.from(byAgency.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((row) => ({ ...row, revenue: Math.round(row.revenue) }));
}

/** Revenue trend bucketed for an arbitrary date range (not just trailing months) — feeds the date-range-aware dashboard. */
export async function getRevenueTrendRanged(from: Date, to: Date, granularity: "hour" | "day" | "week") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("total, status, created_at")
    .in("status", ["paid", "processing", "completed"])
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (const key of enumerateBuckets(from, to, granularity)) buckets.set(key, { revenue: 0, orders: 0 });

  for (const order of data ?? []) {
    const key = bucketKey(new Date(order.created_at), granularity);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(order.total);
    bucket.orders += 1;
  }

  return Array.from(buckets.entries()).map(([key, value]) => ({
    month: bucketLabel(key, granularity),
    revenue: Math.round(value.revenue),
    orders: value.orders,
  }));
}

/** Bookings-by-type for an arbitrary date range. */
export async function getBookingsByTypeRanged(from: Date, to: Date) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("item_type, created_at, orders!inner(status, created_at)")
    .in("orders.status", ["paid", "processing", "completed"])
    .gte("orders.created_at", from.toISOString())
    .lte("orders.created_at", to.toISOString());

  const counts: Record<string, number> = { hotel: 0, flight: 0, visa: 0, umrah: 0, hall: 0 };
  for (const item of data ?? []) {
    counts[item.item_type] = (counts[item.item_type] ?? 0) + 1;
  }

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

  const [current, previous] = await Promise.all([
    Promise.all([
      supabase.from("profiles").select("created_at").gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
      supabase.from("orders").select("created_at").gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
      supabase.from("orders").select("total, created_at").in("status", ["paid", "completed"]).gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
      supabase
        .from("agency_applications")
        .select("created_at", { count: "exact" })
        .eq("status", "pending")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString()),
    ]),
    Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", previousFrom.toISOString()).lte("created_at", previousTo.toISOString()),
      supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", previousFrom.toISOString()).lte("created_at", previousTo.toISOString()),
      supabase.from("orders").select("total").in("status", ["paid", "completed"]).gte("created_at", previousFrom.toISOString()).lte("created_at", previousTo.toISOString()),
    ]),
  ]);

  const [newUsers, newOrders, paidOrders] = current;
  const [prevUsersRes, prevOrdersRes, prevPaidOrders] = previous;

  const buckets = enumerateBuckets(from, to, granularity);
  const usersSeries = new Array(buckets.length).fill(0);
  const ordersSeries = new Array(buckets.length).fill(0);
  const revenueSeries = new Array(buckets.length).fill(0);
  const bucketIndex = new Map(buckets.map((b, i) => [b, i]));

  for (const row of newUsers.data ?? []) {
    const idx = bucketIndex.get(bucketKey(new Date(row.created_at), granularity));
    if (idx !== undefined) usersSeries[idx] += 1;
  }
  for (const row of newOrders.data ?? []) {
    const idx = bucketIndex.get(bucketKey(new Date(row.created_at), granularity));
    if (idx !== undefined) ordersSeries[idx] += 1;
  }
  for (const row of paidOrders.data ?? []) {
    const idx = bucketIndex.get(bucketKey(new Date(row.created_at), granularity));
    if (idx !== undefined) revenueSeries[idx] += Number(row.total);
  }

  const prevRevenue = (prevPaidOrders.data ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  return {
    users: { current: newUsers.data?.length ?? 0, previous: prevUsersRes.count ?? 0, series: usersSeries },
    orders: { current: newOrders.data?.length ?? 0, previous: prevOrdersRes.count ?? 0, series: ordersSeries },
    revenue: { current: Math.round(revenueSeries.reduce((a, b) => a + b, 0)), previous: Math.round(prevRevenue), series: revenueSeries },
  };
}
