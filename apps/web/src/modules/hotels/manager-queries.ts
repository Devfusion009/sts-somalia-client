import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ManagerPermission } from "./manager-permissions";

export type ManagedHotel = {
  managerId: string;
  hotelId: string;
  permissions: string[];
  hotel: { id: string; name: string; city: string; country_code: string; status: string; star_rating: number | null; logo_path: string | null };
};

/**
 * Every hotel the signed-in user manages, with their permission grants —
 * the manager portal's entire scope. Backed by the applicant's own
 * hotel_managers rows ("self reads own assignment" RLS) plus the manager
 * read policy on hotels; nothing here can see another tenant's data even if
 * the query were wrong, but every page still re-checks its hotelId against
 * this list so a guessed URL 404s instead of leaning on RLS returning empty.
 */
export async function getMyManagedHotels(profileId: string): Promise<ManagedHotel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_managers")
    .select("id, hotel_id, permissions, hotel:hotels(id, name, city, country_code, status, star_rating, logo_path)")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((row) => row.hotel)
    .map((row) => ({
      managerId: row.id,
      hotelId: row.hotel_id,
      permissions: row.permissions,
      hotel: row.hotel as unknown as ManagedHotel["hotel"],
    }));
}

/** The one assignment for this hotel, or null — the per-page tenant gate. */
export async function getMyManagedHotel(profileId: string, hotelId: string): Promise<ManagedHotel | null> {
  const hotels = await getMyManagedHotels(profileId);
  return hotels.find((h) => h.hotelId === hotelId) ?? null;
}

export function hasPermission(managed: ManagedHotel, permission: ManagerPermission): boolean {
  return managed.permissions.includes(permission);
}

/** Bookings still waiting on a decision — the manager nav badge. */
export async function getPendingBookingCount(hotelId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("hotel_bookings")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .in("status", ["pending", "waitlisted"]);
  return count ?? 0;
}

/**
 * Active managers assigned to one hotel — read by both the admin console and
 * the owning partner (RLS: "hotel_managers: authorized manage", migration
 * 20260824000001), so this single query serves both without a caller param.
 */
export async function getHotelManagers(hotelId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_managers")
    .select("id, created_at, permissions, profile:profiles!hotel_managers_profile_id_fkey(id, full_name, email)")
    .eq("hotel_id", hotelId)
    .eq("status", "active")
    .order("created_at");
  return data ?? [];
}

export async function getHotelReviews(hotelId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_reviews")
    .select("id, author_name, rating, body, source, status, created_at")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
