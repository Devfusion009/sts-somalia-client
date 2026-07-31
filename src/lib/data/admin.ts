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

export async function getAllUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
