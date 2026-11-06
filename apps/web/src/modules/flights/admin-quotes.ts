import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Flight quote requests for the admin desk. A traveller or agent asking for
 * a fare creates an unpriced `flight_bookings` row (provider 'quote_request');
 * nothing reaches the orders ledger until staff price it here, so this list
 * is the only place those requests surface.
 */
export type FlightQuoteRequest = Awaited<ReturnType<typeof getFlightQuoteRequests>>[number];

export async function getFlightQuoteRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("flight_bookings")
    .select(
      `id, status, trip_type, origin_iata, destination_iata, depart_at, return_at, cabin_class,
       total_price, currency, provider_booking_ref, raw_payload, created_at, agency_id,
       customer:profiles!flight_bookings_customer_id_fkey(full_name, email, phone),
       agency:agencies(name),
       agency_customer:agency_customer_id(full_name, phone),
       order_items(id, order:orders(id, order_number, status, total, currency))`
    )
    .eq("provider", "quote_request")
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => {
    const payload = (row.raw_payload ?? {}) as {
      passengers?: number;
      contact_phone?: string;
      notes?: string | null;
      quote?: { airline?: string | null; note?: string | null };
    };
    const item = row.order_items?.[0];
    const order = item ? (Array.isArray(item.order) ? item.order[0] : item.order) : null;
    return {
      ...row,
      passengers: Number(payload.passengers ?? 1),
      contactPhone: payload.contact_phone ?? null,
      notes: payload.notes ?? null,
      quote: payload.quote ?? null,
      order: order ?? null,
    };
  });
}
