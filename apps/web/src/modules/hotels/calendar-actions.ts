"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CalendarNight = { night: string; minRate: number | null; available: boolean };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Cheapest nightly rate and availability per date for one hotel, for the date
 * picker. Public data (hotel_price_calendar is anon-callable); at most 60
 * nights per call.
 */
export async function getHotelPriceCalendar(hotelId: string, from: string, to: string): Promise<CalendarNight[]> {
  if (!z.string().uuid().safeParse(hotelId).success || !isoDate.safeParse(from).success || !isoDate.safeParse(to).success) {
    return [];
  }
  if (to <= from) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("hotel_price_calendar", { p_hotel_id: hotelId, p_from: from, p_to: to });
  return (data ?? []).map((row) => ({
    night: row.night,
    minRate: row.min_rate === null ? null : Number(row.min_rate),
    available: row.available,
  }));
}
