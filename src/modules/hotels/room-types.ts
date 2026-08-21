import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared room-type catalog (hotel_room_types) — read from both the admin
 * hotel-management pages and the hotel-partner portal, since both places
 * let someone add/edit a room and both should offer (and grow) the exact
 * same suggestion list. See rememberRoomType() below for the write side.
 */
export async function getRoomTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("hotel_room_types").select("name").order("name");
  return (data ?? []).map((r) => r.name);
}

/**
 * Adds a room's type name to the shared catalog if it isn't already there.
 * Called after a room save succeeds, by both admin (modules/admin/actions.ts)
 * and hotel-partner (modules/hotels/partner-actions.ts) room actions — an
 * admin curating the catalog and an approved partner registering their real
 * rooms are both legitimate sources of new room types, so both write
 * through the caller's own RLS-scoped client (see the "admin manage" /
 * "hotel partner members add" policies on hotel_room_types) rather than a
 * service-role bypass. citext uniqueness makes this a no-op for a name that
 * only differs by case.
 */
export async function rememberRoomType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string
): Promise<void> {
  await supabase.from("hotel_room_types").upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
}
