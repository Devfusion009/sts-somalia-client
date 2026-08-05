import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardStats() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { count: totalOrders },
    { data: paidOrders },
    { count: pendingAgency },
    { count: pendingPartner },
    { count: pendingAffiliate },
  ] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total").in("status", ["paid", "completed"]),
    supabase.from("agency_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("hotel_partner_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("affiliate_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
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
    pendingApplications: (pendingAgency ?? 0) + (pendingPartner ?? 0) + (pendingAffiliate ?? 0),
    pendingAgency: pendingAgency ?? 0,
    pendingPartner: pendingPartner ?? 0,
    pendingAffiliate: pendingAffiliate ?? 0,
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

export async function getAllOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, total, created_at, customer:profiles!orders_customer_id_fkey(full_name, email), payments(id, provider, method_label, amount, currency, status, payer_phone, created_at)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return data ?? [];
}

export async function getVisaTypesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_types").select("*").order("created_at", { ascending: false });
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

export async function getUmrahPackageById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select("*, umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, price_override)")
    .eq("id", id)
    .maybeSingle();
  return data;
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
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getHallBookingsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hall_bookings")
    .select(
      "*, venue:venue_id(name, city), customer:profiles!hall_bookings_customer_id_fkey(full_name, email)"
    )
    .order("event_date", { ascending: true })
    .limit(300);
  return data ?? [];
}

export async function getUpcomingHallBookings(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hall_bookings")
    .select("id, booking_ref, event_type, event_date, expected_guests, status, venue:venue_id(name)")
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .in("status", ["pending", "confirmed"])
    .order("event_date", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function getAllUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
