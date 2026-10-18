import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStayPrices, type NightlyRate } from "@/modules/hotels/rates";

export type RateRule = {
  id: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  dateStart: string;
  dateEnd: string;
  weekdays: number[] | null;
  adjustment: "percent" | "fixed";
  value: number;
};

export type RatePreviewRow = {
  roomId: string;
  roomName: string;
  currency: string;
  basePrice: number;
  nights: NightlyRate[];
};

export async function getRateRules(hotelId: string): Promise<RateRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_rate_rules")
    .select("id, name, room_id, date_start, date_end, weekdays, adjustment, value, room:hotel_rooms(name)")
    .eq("hotel_id", hotelId)
    .order("date_start", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    roomId: r.room_id,
    roomName: r.room?.name ?? null,
    dateStart: r.date_start,
    dateEnd: r.date_end,
    weekdays: r.weekdays,
    adjustment: r.adjustment === "fixed" ? "fixed" : "percent",
    value: Number(r.value),
  }));
}

/** Effective nightly price for every room type over the next `days` nights. */
export async function getRatePreview(hotelId: string, from: string, days: number): Promise<RatePreviewRow[]> {
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("hotel_rooms")
    .select("id, name, base_price, currency")
    .eq("hotel_id", hotelId)
    .order("base_price");
  const list = rooms ?? [];
  const end = new Date(`${from}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const prices = await getStayPrices(supabase, list, from, end.toISOString().slice(0, 10));
  return list.map((r) => ({
    roomId: r.id,
    roomName: r.name,
    currency: r.currency,
    basePrice: Number(r.base_price),
    nights: prices.get(r.id)?.nights ?? [],
  }));
}
