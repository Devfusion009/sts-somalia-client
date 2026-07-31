import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FlightSearchFilters = {
  origin?: string;
  destination?: string;
  departDate?: string;
};

/**
 * Reads the flight_offers cache table. There is no live GDS/NDC provider
 * integration in this build (Amadeus/Duffel etc. require paid API access),
 * so this table is populated only if/when that integration is added later.
 * In practice this returns an empty array today — that's expected, not a bug.
 */
export async function searchFlightOffers(filters: FlightSearchFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("flight_offers")
    .select("*, airlines(name, iata_code)")
    .gt("expires_at", new Date().toISOString());

  if (filters.origin) query = query.eq("origin_iata", filters.origin.toUpperCase());
  if (filters.destination) query = query.eq("destination_iata", filters.destination.toUpperCase());
  if (filters.departDate) {
    const start = new Date(`${filters.departDate}T00:00:00.000Z`).toISOString();
    const end = new Date(`${filters.departDate}T23:59:59.999Z`).toISOString();
    query = query.gte("depart_at", start).lte("depart_at", end);
  }

  const { data } = await query.order("depart_at", { ascending: true });
  return data ?? [];
}
