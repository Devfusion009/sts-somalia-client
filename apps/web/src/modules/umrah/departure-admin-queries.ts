import "server-only";
import { createClient } from "@/lib/supabase/server";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Departures from `from` on, aggregated in SQL (seats, readiness, money owed). */
export async function getDeparturesOverview(from: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("umrah_departures_overview", { p_from: from });
  return data ?? [];
}

export async function getDepartureAdmin(departureId: string) {
  const supabase = await createClient();
  const [{ data: departure }, { data: manifest }, { data: rooms }] = await Promise.all([
    supabase
      .from("umrah_package_departures")
      .select(
        "id, package_id, departure_date, return_date, total_seats, booked_seats, offline_seats, status, sales_close_days, outbound_airline, outbound_flight_number, return_airline, return_flight_number, package:package_id(id, name, currency)"
      )
      .eq("id", departureId)
      .maybeSingle(),
    supabase.rpc("umrah_departure_manifest", { p_departure_id: departureId }),
    supabase
      .from("umrah_room_assignments")
      .select("id, city, room_label, capacity, gender, umrah_room_occupants(pilgrim_id)")
      .eq("departure_id", departureId)
      .order("city")
      .order("room_label"),
  ]);
  if (!departure) return null;

  return {
    departure: { ...departure, package: one(departure.package) },
    manifest: manifest ?? [],
    rooms: (rooms ?? []).map((r) => ({ ...r, occupants: (r.umrah_room_occupants ?? []).map((o) => o.pilgrim_id) })),
  };
}
