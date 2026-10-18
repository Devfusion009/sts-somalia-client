import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/**
 * Blocking one room removes it from sale for those nights, so refuse when
 * existing bookings already need every room that would remain. Returns the
 * message to show, or null when the block fits. `to` is exclusive.
 */
export async function blockConflict(
  supabase: SupabaseClient<Database>,
  hotelId: string,
  roomTypeId: string,
  from: string,
  to: string
): Promise<string | null> {
  const days = Math.min(120, Math.max(1, daysBetween(from, to)));
  const { data } = await supabase.rpc("hotel_availability", {
    p_hotel_id: hotelId,
    p_from: from,
    p_days: days,
    p_room_id: roomTypeId,
  });
  const clash = (data ?? []).find((n) => n.capacity !== null && n.capacity - 1 < n.booked);
  return clash ? `Bookings on ${clash.night} need this room. Move them first.` : null;
}
