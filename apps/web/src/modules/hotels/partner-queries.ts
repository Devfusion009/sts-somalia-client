import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hotelGuestNames } from "@/modules/orders/format";

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
  const { data } = await supabase
    .from("hotel_partners")
    .select("*")
    .eq("id", partnerId)
    .maybeSingle();
  return data;
}

/**
 * Every hotel the current user can operationally act on: every property
 * their hotel_partner business owns, PLUS any single hotel admin assigned
 * them to manage directly (hotel_managers — see 20260820000003). Backed by
 * the my_operable_hotel_ids() SQL function so the two sources are unioned in
 * one round trip; RLS (is_hotel_partner_member / is_hotel_manager) is the
 * real authority, this is what the app layer filters queries by so a
 * manager's dashboard/list views don't rely on trial-and-error against RLS.
 *
 * partnerId stays separate (not folded into hotelIds) because it also gates
 * capabilities hotelIds alone can't express: creating a brand-new hotel, and
 * editing an existing one's own core listing fields (name, address, star
 * rating) — both business-owner-only, never a single-hotel manager's.
 */
export type HotelScope = { partnerId: string | null; hotelIds: string[] };

export async function getMyHotelScope(profileId: string): Promise<HotelScope> {
  const supabase = await createClient();
  const [partnerId, { data: ids }] = await Promise.all([
    getMyPartnerId(profileId),
    supabase.rpc("my_operable_hotel_ids"),
  ]);
  return { partnerId, hotelIds: ids ?? [] };
}

export async function getMyHotels(hotelIds: string[]) {
  if (hotelIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(
      "id, name, slug, city, country_code, star_rating, images, status, partner_id, hotel_rooms(id)",
    )
    .in("id", hotelIds)
    .order("created_at", { ascending: false });

  return (data ?? []).map((h) => ({ ...h, roomCount: h.hotel_rooms.length }));
}

/** Scoped by hotelIds in the query itself (not just relying on RLS) so a
 * user can never fetch a hotel outside their scope by guessing an id. */
export async function getHotelForEdit(hotelId: string, hotelIds: string[]) {
  if (!hotelIds.includes(hotelId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select("*, hotel_rooms(*), property_links(label, url, sort_order)")
    .eq("id", hotelId)
    .maybeSingle();

  return data;
}

/** Room + parent hotel, scoped by hotelIds like getHotelForEdit. */
export async function getRoomForInventory(
  roomId: string,
  hotelId: string,
  hotelIds: string[],
) {
  if (!hotelIds.includes(hotelId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_rooms")
    .select("*, hotels!inner(id, name, partner_id)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  return data;
}

/** Physical rooms (number, floor, status) under one room type — the front desk board's row list. */
export async function getRoomUnits(
  roomTypeId: string,
  hotelId: string,
  hotelIds: string[],
) {
  if (!hotelIds.includes(hotelId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_room_units")
    .select("*")
    .eq("room_type_id", roomTypeId)
    .eq("hotel_id", hotelId)
    .order("floor")
    .order("room_number");
  return data ?? [];
}

export type RoomBlock = {
  id: string;
  roomUnitId: string;
  dateStart: string;
  dateEnd: string;
  reason: string | null;
};

/** Upcoming and current date blocks on the rooms of one room type. */
export async function getRoomBlocks(roomTypeId: string, hotelId: string, hotelIds: string[]): Promise<RoomBlock[]> {
  if (!hotelIds.includes(hotelId)) return [];
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("hotel_room_disable_dates")
    .select("id, room_unit_id, date_start, date_end, reason, unit:hotel_room_units!inner(room_type_id, hotel_id)")
    .eq("unit.room_type_id", roomTypeId)
    .eq("unit.hotel_id", hotelId)
    .gt("date_end", today)
    .order("date_start");
  return (data ?? []).map((b) => ({
    id: b.id,
    roomUnitId: b.room_unit_id,
    dateStart: b.date_start,
    dateEnd: b.date_end,
    reason: b.reason,
  }));
}

/**
 * Every live (not cancelled/failed/refunded) booking against one room type,
 * newest stay first — what actually occupies its nights, online or offline,
 * so "is this date free" is answered by reading the real ledger instead of
 * trusting a capacity number in isolation.
 */
export async function getRoomBookings(
  roomTypeId: string,
  hotelId: string,
  hotelIds: string[],
) {
  if (!hotelIds.includes(hotelId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, check_in, check_out, num_rooms, num_adults, num_children, status, source, guest_details, special_requests, created_at",
    )
    .eq("room_id", roomTypeId)
    .eq("hotel_id", hotelId)
    .in("status", ["pending", "confirmed", "waitlisted"])
    .order("check_in", { ascending: true });
  // Resolved to a plain string here (server-only helper) so the client
  // component below never needs to import anything server-only itself.
  return (data ?? []).map((b) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    num_rooms: b.num_rooms,
    num_adults: b.num_adults,
    num_children: b.num_children,
    status: b.status,
    source: b.source,
    guestName: hotelGuestNames(b.guest_details)[0] ?? null,
    special_requests: b.special_requests,
    created_at: b.created_at,
  }));
}

/**
 * The front-desk snapshot for one hotel: who's actually staying right now,
 * arriving today, and leaving today — read straight off hotel_bookings
 * (check_in/check_out + guest_details), not hotel_room_inventory (that
 * table is caps/pricing per date, not an occupant list, and often has no
 * row at all for a given night when no cap was ever set). 'confirmed' is
 * the only status that means an actual stay — pending isn't guaranteed yet,
 * cancelled/completed/refunded aren't current.
 */
export async function getHotelFrontDesk(hotelId: string, hotelIds: string[]) {
  if (!hotelIds.includes(hotelId))
    return { inHouse: [], arrivingToday: [], departingToday: [] };
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, check_in, check_out, num_rooms, num_adults, checked_in_at, checked_out_at, guest_details, hotel_rooms(name)",
    )
    .eq("hotel_id", hotelId)
    .eq("status", "confirmed")
    .gte("check_out", today)
    .order("check_in");

  const bookings = data ?? [];
  return {
    inHouse: bookings.filter((b) => b.check_in <= today && b.check_out > today),
    arrivingToday: bookings.filter((b) => b.check_in === today),
    departingToday: bookings.filter((b) => b.check_out === today),
  };
}

/**
 * One week's occupancy across every room type (booked vs. capacity room-
 * nights, from the same allocator-fed numbers the Availability board shows)
 * plus how many confirmed stays arrive in that window — the three figures
 * the manager dashboard's Forecast panel is built from.
 */
export async function getWeekForecast(hotelId: string, weekStart: string) {
  const supabase = await createClient();
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  const [{ data: rooms }, { count }] = await Promise.all([
    supabase.rpc("hotel_availability", {
      p_hotel_id: hotelId,
      p_from: weekStart,
      p_days: 7,
    }),
    supabase
      .from("hotel_bookings")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "confirmed")
      .gte("check_in", weekStart)
      .lt("check_in", weekEndIso),
  ]);

  let bookedNights = 0;
  let capacityNights = 0;
  for (const row of rooms ?? []) {
    if (row.capacity === null) continue;
    capacityNights += row.capacity;
    bookedNights += row.booked;
  }

  return {
    weekEnd: weekEndIso,
    bookedNights,
    capacityNights,
    occupancyPct:
      capacityNights > 0
        ? Math.round((bookedNights / capacityNights) * 100)
        : 0,
    arrivals: count ?? 0,
  };
}

export async function getPartnerBookings(hotelIds: string[]) {
  if (hotelIds.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, hotel_id, check_in, check_out, checked_in_at, num_rooms, num_adults, num_children, status, channel, source, payment_method, paid_at, total_price, currency, created_at, guest_details, hotels(name), hotel_rooms(name)",
    )
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Every hotel_id in scope where the current user can change booking status —
 * always every owned hotel, and only those managed hotels admin granted
 * the 'bookings' permission on (20260821000002). Drives which rows on the
 * bookings list get the editable status control vs. a read-only badge.
 */
export async function getMyBookingManageableHotelIds(
  profileId: string,
  scope: HotelScope,
): Promise<Set<string>> {
  if (scope.partnerId !== null) return new Set(scope.hotelIds);
  if (scope.hotelIds.length === 0) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_managers")
    .select("hotel_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .contains("permissions", ["bookings"])
    .in("hotel_id", scope.hotelIds);

  return new Set((data ?? []).map((row) => row.hotel_id));
}

export async function getPartnerStats(hotelIds: string[]) {
  const supabase = await createClient();
  const hotelCount = hotelIds.length;
  const hotels =
    hotelIds.length > 0
      ? await supabase
          .from("hotels")
          .select("id, hotel_rooms(id)")
          .in("id", hotelIds)
      : { data: [] };

  const roomCount = (hotels.data ?? []).reduce(
    (sum, h) => sum + h.hotel_rooms.length,
    0,
  );

  let bookingCount = 0;
  let pendingCount = 0;
  let revenue = 0;
  let revenueCurrency = "USD";
  if (hotelIds.length > 0) {
    const [{ count: total }, { count: pending }, settled] = await Promise.all([
      supabase
        .from("hotel_bookings")
        .select("*", { count: "exact", head: true })
        .in("hotel_id", hotelIds),
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
    revenue = (settled.data ?? []).reduce(
      (sum, b) => sum + Number(b.total_price),
      0,
    );
    revenueCurrency = settled.data?.[0]?.currency ?? "USD";
  }

  return {
    hotelCount,
    roomCount,
    bookingCount,
    pendingCount,
    revenue,
    revenueCurrency,
  };
}

/** Latest bookings across the user's operable hotels, for the dashboard. */
export async function getRecentPartnerBookings(hotelIds: string[], limit = 5) {
  if (hotelIds.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, check_in, check_out, status, total_price, currency, created_at, hotels(name), hotel_rooms(name)",
    )
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
