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
    .select("id, name, slug, city, country_code, star_rating, images, status, hotel_rooms(id)")
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

/** Room + parent hotel, scoped by partner_id like getHotelForEdit. */
export async function getRoomForInventory(roomId: string, hotelId: string, partnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_rooms")
    .select("*, hotels!inner(id, name, partner_id)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .eq("hotels.partner_id", partnerId)
    .maybeSingle();
  return data;
}

/** Upcoming capped nights for a room (today onwards, capped window). */
export async function getRoomInventory(roomId: string, days = 60) {
  const supabase = await createClient();
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("hotel_room_inventory")
    .select("id, date, total_units, booked_units, price_override")
    .eq("room_id", roomId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  return data ?? [];
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
  let revenue = 0;
  let revenueCurrency = "USD";
  if (hotelIds.length > 0) {
    const [{ count: total }, { count: pending }, settled] = await Promise.all([
      supabase.from("hotel_bookings").select("*", { count: "exact", head: true }).in("hotel_id", hotelIds),
      supabase
        .from("hotel_bookings")
        .select("*", { count: "exact", head: true })
        .in("hotel_id", hotelIds)
        .eq("status", "pending"),
      supabase
        .from("hotel_bookings")
        .select("total_price, currency")
        .in("hotel_id", hotelIds)
        .in("status", ["confirmed", "completed"]),
    ]);
    bookingCount = total ?? 0;
    pendingCount = pending ?? 0;
    revenue = (settled.data ?? []).reduce((sum, b) => sum + Number(b.total_price), 0);
    revenueCurrency = settled.data?.[0]?.currency ?? "USD";
  }

  return { hotelCount: hotelCount ?? 0, roomCount, bookingCount, pendingCount, revenue, revenueCurrency };
}

/** Latest bookings across the partner's hotels, for the dashboard. */
export async function getRecentPartnerBookings(partnerId: string, limit = 5) {
  const supabase = await createClient();
  const { data: hotels } = await supabase.from("hotels").select("id").eq("partner_id", partnerId);
  const hotelIds = (hotels ?? []).map((h) => h.id);
  if (hotelIds.length === 0) return [];

  const { data } = await supabase
    .from("hotel_bookings")
    .select("id, check_in, check_out, status, total_price, currency, created_at, hotels(name), hotel_rooms(name)")
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
