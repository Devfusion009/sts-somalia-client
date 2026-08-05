import "server-only";
import { createClient } from "@/lib/supabase/server";

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
       order_items (
         *,
         hotel_booking:hotel_booking_id (id, check_in, check_out, num_rooms, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (id, num_pilgrims, package:package_id (name)),
         hall_booking:hall_booking_id (id, event_date, event_type, venue:venue_id (name))
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
    .select("agency_id, role_in_agency, agencies(id, name, status, commission_rate, contact_email)")
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

export async function getAgencyTeam(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_members")
    .select("id, role_in_agency, status, created_at, profiles(full_name, email)")
    .eq("agency_id", agencyId)
    .order("created_at");

  return data ?? [];
}
