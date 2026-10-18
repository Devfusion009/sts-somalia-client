import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";

export const REPORT_RANGES = [
  { key: "last7", label: "Last 7 days", days: 7, direction: "back" },
  { key: "last30", label: "Last 30 days", days: 30, direction: "back" },
  { key: "last90", label: "Last 90 days", days: 90, direction: "back" },
  { key: "next30", label: "Next 30 days", days: 30, direction: "forward" },
] as const;

export type ReportRangeKey = (typeof REPORT_RANGES)[number]["key"];

export function resolveRange(key: string | undefined) {
  const range = REPORT_RANGES.find((r) => r.key === key) ?? REPORT_RANGES[1];
  const today = todayIso();
  const base = new Date(`${today}T00:00:00Z`);
  const from = new Date(base);
  if (range.direction === "back") from.setUTCDate(from.getUTCDate() - range.days);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + range.days);
  return { ...range, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export type ChannelKey = "online" | "agency" | "offline";

export type HotelReport = {
  currency: string;
  kpis: {
    bookings: number;
    stays: number;
    revenue: number;
    roomNights: number;
    adr: number | null;
    occupancyPct: number | null;
    cancellationRate: number | null;
    noShows: number;
  };
  daily: Array<{ date: string; booked: number; capacity: number }>;
  byRoom: Array<{
    roomId: string;
    name: string;
    stays: number;
    roomNights: number;
    revenue: number;
    adr: number | null;
    occupancyPct: number | null;
  }>;
  byChannel: Array<{ channel: ChannelKey; bookings: number; revenue: number }>;
};

function nightsOf(checkIn: string, checkOut: string) {
  return Math.max(
    1,
    Math.round((new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000)
  );
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/**
 * Bookings arriving in [from, to) plus the nightly occupancy over the same
 * window. Revenue is the total of confirmed and completed stays by arrival
 * date; occupancy comes from the same availability ledger the allocator uses.
 */
export async function getHotelReport(hotelId: string, from: string, to: string): Promise<HotelReport> {
  const supabase = await createClient();
  const days = Math.max(1, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000));

  const [{ data: bookings }, { data: rooms }, availability] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select("id, room_id, status, channel, source, check_in, check_out, num_rooms, total_price, currency")
      .eq("hotel_id", hotelId)
      .gte("check_in", from)
      .lt("check_in", to),
    supabase.from("hotel_rooms").select("id, name").eq("hotel_id", hotelId),
    getHotelAvailability(hotelId, { from, days: Math.min(days, 120) }),
  ]);

  const list = bookings ?? [];
  const stays = list.filter((b) => b.status === "confirmed" || b.status === "completed");
  const cancelled = list.filter((b) => b.status === "cancelled" || b.status === "refunded");
  const revenue = stays.reduce((sum, b) => sum + Number(b.total_price), 0);
  const roomNights = stays.reduce((sum, b) => sum + nightsOf(b.check_in, b.check_out) * b.num_rooms, 0);

  const dailyMap = new Map<string, { booked: number; capacity: number }>();
  const occupancyByRoom = new Map<string, { booked: number; capacity: number }>();
  for (const room of availability) {
    for (const n of room.nights) {
      if (n.capacity === null) continue;
      const day = dailyMap.get(n.night) ?? { booked: 0, capacity: 0 };
      day.booked += n.booked;
      day.capacity += n.capacity;
      dailyMap.set(n.night, day);
      const r = occupancyByRoom.get(room.roomId) ?? { booked: 0, capacity: 0 };
      r.booked += n.booked;
      r.capacity += n.capacity;
      occupancyByRoom.set(room.roomId, r);
    }
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
  const totalBooked = daily.reduce((s, d) => s + d.booked, 0);
  const totalCapacity = daily.reduce((s, d) => s + d.capacity, 0);

  const byRoom = (rooms ?? []).map((room) => {
    const mine = stays.filter((b) => b.room_id === room.id);
    const nights = mine.reduce((sum, b) => sum + nightsOf(b.check_in, b.check_out) * b.num_rooms, 0);
    const rev = mine.reduce((sum, b) => sum + Number(b.total_price), 0);
    const occ = occupancyByRoom.get(room.id);
    return {
      roomId: room.id,
      name: room.name,
      stays: mine.length,
      roomNights: nights,
      revenue: rev,
      adr: nights > 0 ? rev / nights : null,
      occupancyPct: occ ? pct(occ.booked, occ.capacity) : null,
    };
  });

  const channelOf = (b: (typeof list)[number]): ChannelKey =>
    b.channel === "b2b" ? "agency" : b.source === "offline" ? "offline" : "online";
  const byChannel = (["online", "agency", "offline"] as const).map((channel) => {
    const mine = list.filter((b) => channelOf(b) === channel);
    return {
      channel,
      bookings: mine.length,
      revenue: mine
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((sum, b) => sum + Number(b.total_price), 0),
    };
  });

  return {
    currency: list[0]?.currency ?? "USD",
    kpis: {
      bookings: list.length,
      stays: stays.length,
      revenue,
      roomNights,
      adr: roomNights > 0 ? revenue / roomNights : null,
      occupancyPct: pct(totalBooked, totalCapacity),
      cancellationRate: pct(cancelled.length, list.length),
      noShows: list.filter((b) => b.status === "no_show").length,
    },
    daily,
    byRoom,
    byChannel,
  };
}
