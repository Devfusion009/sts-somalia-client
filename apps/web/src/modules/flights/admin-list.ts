import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const FLIGHT_VIEWS = [
  { key: "all", label: "All", statuses: null, legacy: null },
  { key: "attention", label: "Needs attention", statuses: ["failed"], legacy: ["failed"] },
  { key: "pending", label: "In progress", statuses: ["queued", "booking", "booked"], legacy: ["pending", "confirmed"] },
  { key: "ticketed", label: "Ticketed", statuses: ["ticketed"], legacy: null },
  { key: "unpaid", label: "Awaiting payment", statuses: ["awaiting_payment"], legacy: null },
] as const;
export type FlightFilters = { view?: string; q?: string; source?: string; days?: string; page?: string };
const columns = "id, agency_id, status, origin_iata, destination_iata, depart_at, return_at, total_price, currency, ticketing_status, ticketing_error, provider_booking_ref, provider_order_id, ticket_numbers, created_at, agency:agency_id(name), customer:customer_id(full_name, email), agency_customer:agency_customer_id(full_name), booked_by_profile:booked_by(full_name, email), passengers:flight_passengers(full_name), order_items(order:orders(id, order_number, status))";

export async function getAdminFlights(input: FlightFilters, offset = 0, size = 50, head = false) {
  const db = createAdminClient();
  const view = FLIGHT_VIEWS.find(v => v.key === input.view) ?? FLIGHT_VIEWS[0];
  let query = db.from("flight_bookings").select(columns, { count: "exact", head });
  if (view.statuses) query = view.legacy
    ? query.or(`ticketing_status.in.(${view.statuses.join(",")}),and(ticketing_status.is.null,status.in.(${view.legacy.join(",")}))`)
    : query.in("ticketing_status", [...view.statuses]);
  if (input.source === "b2b") query = query.not("agency_id", "is", null);
  if (input.source === "b2c") query = query.is("agency_id", null);
  if (["7", "30", "90"].includes(input.days ?? "")) query = query.gte("created_at", new Date(Date.now() - Number(input.days) * 86400000).toISOString());
  const term = (input.q ?? "").trim().slice(0,100).replace(/[^\p{L}\p{N} @.\-]/gu," ").trim();
  if (term) {
    const matches = await Promise.all([
      db.from("profiles").select("id").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(500),
      db.from("agency_customers").select("id").ilike("full_name",`%${term}%`).limit(500),
      db.from("orders").select("id").ilike("order_number",`%${term}%`).limit(500),
    ]);
    if (matches.some(r => r.error)) throw new Error("Flight search could not be completed.");
    const parts = [`origin_iata.ilike.%${term}%`, `destination_iata.ilike.%${term}%`, `provider_booking_ref.ilike.%${term}%`];
    if (/^[0-9a-f-]{36}$/i.test(term)) parts.push(`id.eq.${term}`);
    for (const [index,field] of [[0,"customer_id"],[1,"agency_customer_id"]] as const) {
      const ids = matches[index].data?.map(r => r.id) ?? [];
      if (ids.length) parts.push(`${field}.in.(${ids.join(",")})`);
    }
    const orderIds = matches[2].data?.map(r => r.id) ?? [];
    if (orderIds.length) {
      const items = await db.from("order_items").select("flight_booking_id").in("order_id",orderIds).not("flight_booking_id","is",null);
      if(items.error) throw new Error("Flight search could not be completed.");
      const ids=items.data?.map(r=>r.flight_booking_id).filter(Boolean) ?? [];
      if(ids.length) parts.push(`id.in.(${ids.join(",")})`);
    }
    query=query.or(parts.join(","));
  }
  const result = await query.order("created_at", {ascending:false}).order("id",{ascending:false}).range(offset,offset+size-1);
  if(result.error) throw new Error("Flight bookings could not be loaded.");
  return result;
}
