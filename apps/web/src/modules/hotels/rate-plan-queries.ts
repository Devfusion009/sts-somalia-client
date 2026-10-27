import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isBoardBasis, isExtraUnit, type HotelExtra, type RatePlan } from "@/modules/hotels/booking-options";

export async function getRatePlans(hotelId: string, opts: { activeOnly?: boolean } = {}): Promise<RatePlan[]> {
  const supabase = await createClient();
  let query = supabase
    .from("hotel_rate_plans")
    .select("id, name, board, board_price_adult, board_price_child, cancellation, free_cancel_days, discount_percent, is_active")
    .eq("hotel_id", hotelId);
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data } = await query.order("sort_order").order("created_at");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    board: isBoardBasis(p.board) ? p.board : "room_only",
    boardPriceAdult: Number(p.board_price_adult),
    boardPriceChild: Number(p.board_price_child),
    cancellation: p.cancellation === "non_refundable" ? "non_refundable" : "flexible",
    freeCancelDays: p.free_cancel_days,
    discountPercent: Number(p.discount_percent),
    isActive: p.is_active,
  }));
}

export async function getHotelExtras(hotelId: string, opts: { activeOnly?: boolean } = {}): Promise<HotelExtra[]> {
  const supabase = await createClient();
  let query = supabase
    .from("hotel_extras")
    .select("id, name, description, price, unit, is_active")
    .eq("hotel_id", hotelId);
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data } = await query.order("sort_order").order("created_at");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    price: Number(e.price),
    unit: isExtraUnit(e.unit) ? e.unit : "per_stay",
    isActive: e.is_active,
  }));
}
