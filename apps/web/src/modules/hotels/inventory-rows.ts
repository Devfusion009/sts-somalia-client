import "server-only";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Rooms-to-sell and price are independent per-night settings: either may be
 * left blank to keep what each night already has. Blank means "unchanged",
 * never "reset" — saving a price must not wipe a night's capacity cap, and
 * capping a night must not wipe its price.
 */
export const inventoryDetailSchema = z
  .object({
    totalUnits: z.coerce.number().int().min(0, "Rooms can't be negative.").max(1000).optional(),
    priceOverride: z.coerce.number().positive("Price must be more than 0.").optional(),
  })
  .refine((d) => d.totalUnits !== undefined || d.priceOverride !== undefined, {
    message: "Enter rooms to sell, a price, or both.",
  });

export function parseInventoryDetail(formData: FormData) {
  return inventoryDetailSchema.safeParse({
    totalUnits: formData.get("totalUnits") || undefined,
    priceOverride: formData.get("priceOverride") || undefined,
  });
}

/**
 * One upsert row per night, merging the submitted fields over what the night
 * already stores. A night with no row yet takes the room's baseline count for
 * any field left blank.
 */
export async function inventoryRows(
  supabase: Supabase,
  roomId: string,
  dates: string[],
  detail: { totalUnits?: number; priceOverride?: number }
): Promise<{ rows: Array<{ room_id: string; date: string; total_units: number; price_override: number | null }> } | { error: string }> {
  const [{ data: room }, { data: existing }] = await Promise.all([
    supabase.from("hotel_rooms").select("total_units").eq("id", roomId).maybeSingle(),
    supabase
      .from("hotel_room_inventory")
      .select("date, total_units, price_override")
      .eq("room_id", roomId)
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]),
  ]);
  const byDate = new Map((existing ?? []).map((r) => [r.date, r]));

  const rows = [];
  for (const date of dates) {
    const current = byDate.get(date);
    const totalUnits = detail.totalUnits ?? current?.total_units ?? room?.total_units ?? null;
    if (totalUnits === null) return { error: "Set the room count first." };
    rows.push({
      room_id: roomId,
      date,
      total_units: totalUnits,
      price_override:
        detail.priceOverride ?? (current?.price_override == null ? null : Number(current.price_override)),
    });
  }
  return { rows };
}
