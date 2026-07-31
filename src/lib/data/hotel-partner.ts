import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getMyPartnerId(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_partner_members")
    .select("partner_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data?.partner_id ?? null;
}

export async function getMyPartner(partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("hotel_partners").select("*").eq("id", partnerId).maybeSingle();
  return data;
}

export async function getMyHotels(partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select("id, name, slug, city, country_code, status, hotel_rooms(id)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((h) => ({ ...h, roomCount: h.hotel_rooms.length }));
}

/** Scoped by partner_id in the query itself (not just relying on RLS) so a
 * partner can never fetch another partner's hotel by guessing an id. */
export async function getHotelForEdit(hotelId: string, partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select("*, hotel_rooms(*)")
    .eq("id", hotelId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  return data;
}

export async function getPartnerBookings(partnerId: string) {
  const supabase = await createClient();
  const { data: hotels } = await supabase.from("hotels").select("id").eq("partner_id", partnerId);
  const hotelIds = (hotels ?? []).map((h) => h.id);
  if (hotelIds.length === 0) return [];

  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, check_in, check_out, num_rooms, num_adults, num_children, status, total_price, currency, created_at, hotels(name), hotel_rooms(name)"
    )
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getPartnerStats(partnerId: string) {
  const supabase = await createClient();
  const [{ count: hotelCount }, hotels] = await Promise.all([
    supabase.from("hotels").select("*", { count: "exact", head: true }).eq("partner_id", partnerId),
    supabase.from("hotels").select("id, hotel_rooms(id)").eq("partner_id", partnerId),
  ]);

  const roomCount = (hotels.data ?? []).reduce((sum, h) => sum + h.hotel_rooms.length, 0);
  const hotelIds = (hotels.data ?? []).map((h) => h.id);

  let bookingCount = 0;
  let pendingCount = 0;
  if (hotelIds.length > 0) {
    const [{ count: total }, { count: pending }] = await Promise.all([
      supabase.from("hotel_bookings").select("*", { count: "exact", head: true }).in("hotel_id", hotelIds),
      supabase
        .from("hotel_bookings")
        .select("*", { count: "exact", head: true })
        .in("hotel_id", hotelIds)
        .eq("status", "pending"),
    ]);
    bookingCount = total ?? 0;
    pendingCount = pending ?? 0;
  }

  return { hotelCount: hotelCount ?? 0, roomCount, bookingCount, pendingCount };
}
