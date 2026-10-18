import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

export type NightlyRate = {
  night: string;
  rate: number;
  source: "override" | "rule" | "base";
  ruleName: string | null;
};

export type StayPrice = { total: number; nights: NightlyRate[] };

function nightsList(checkIn: string, checkOut: string) {
  const out: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * What each room costs for a stay, night by night: the per-date override, else
 * the best matching rate rule, else the base price (hotel_nightly_rates).
 * Every booking path prices through here, so the figure quoted is the figure
 * charged. If the database function is not available the per-date overrides
 * and base price still price the stay, as before rate rules existed.
 */
export async function getStayPrices(
  supabase: SupabaseClient<Database>,
  rooms: Array<{ id: string; base_price: number | string }>,
  checkIn: string,
  checkOut: string
): Promise<Map<string, StayPrice>> {
  const result = new Map<string, StayPrice>();
  if (rooms.length === 0) return result;
  const ids = rooms.map((r) => r.id);

  const { data, error } = await supabase.rpc("hotel_nightly_rates", {
    p_room_ids: ids,
    p_from: checkIn,
    p_to: checkOut,
  });

  if (!error && data) {
    for (const room of rooms) {
      const nights = data
        .filter((row) => row.room_id === room.id)
        .map<NightlyRate>((row) => ({
          night: row.night,
          rate: Number(row.rate),
          source: row.source as NightlyRate["source"],
          ruleName: row.rule_name,
        }));
      if (nights.length > 0) {
        result.set(room.id, { total: nights.reduce((sum, n) => sum + n.rate, 0), nights });
      }
    }
    if (result.size === rooms.length) return result;
  }

  const { data: inventory } = await supabase
    .from("hotel_room_inventory")
    .select("room_id, date, price_override")
    .in("room_id", ids)
    .gte("date", checkIn)
    .lt("date", checkOut);
  for (const room of rooms) {
    if (result.has(room.id)) continue;
    const base = Number(room.base_price);
    const overrides = new Map(
      (inventory ?? [])
        .filter((r) => r.room_id === room.id && r.price_override !== null)
        .map((r) => [r.date, Number(r.price_override)])
    );
    const nights = nightsList(checkIn, checkOut).map<NightlyRate>((night) => {
      const override = overrides.get(night);
      return override === undefined
        ? { night, rate: base, source: "base", ruleName: null }
        : { night, rate: override, source: "override", ruleName: null };
    });
    result.set(room.id, { total: nights.reduce((sum, n) => sum + n.rate, 0), nights });
  }
  return result;
}
