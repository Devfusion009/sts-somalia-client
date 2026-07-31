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
    .select("id, order_number, status, currency, total, created_at, customer:profiles!orders_customer_id_fkey(full_name, email)")
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

export async function getAllUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
