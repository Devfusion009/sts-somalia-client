"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getActiveAgencyId } from "@/modules/orders/helpers";

export type QuoteActionState = { error: string | null; success?: boolean } | null;

const quoteSchema = z.object({
  origin: z.string().length(3, "Select a departure airport."),
  destination: z.string().length(3, "Select a destination airport."),
  departDate: z.string().min(1, "Choose a departure date."),
  returnDate: z.string().optional(),
  tripType: z.enum(["one_way", "round_trip"]),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  adults: z.coerce.number().int().min(1, "At least one passenger.").max(9, "Maximum 9 passengers."),
  contactPhone: z.string().min(7, "Enter a contact phone number."),
  notes: z.string().max(1000).optional(),
});

/**
 * A quote request is a flight_bookings row with provider 'quote_request' and
 * price 0 — STS staff respond with fare options and finalize the booking
 * (and its order) from the admin side. No checkout happens here.
 */
export async function requestFlightQuote(
  _prev: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const parsed = quoteSchema.safeParse({
    origin: formData.get("origin")?.toString().toUpperCase(),
    destination: formData.get("destination")?.toString().toUpperCase(),
    departDate: formData.get("departDate"),
    returnDate: formData.get("returnDate")?.toString() || undefined,
    tripType: formData.get("tripType") ?? "one_way",
    cabinClass: formData.get("cabinClass") ?? "economy",
    adults: formData.get("adults") ?? 1,
    contactPhone: formData.get("contactPhone"),
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.origin === d.destination) {
    return { error: "Origin and destination must be different." };
  }
  if (d.tripType === "round_trip" && !d.returnDate) {
    return { error: "Choose a return date for a round trip." };
  }

  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("flight_bookings").insert({
    customer_id: user.id,
    booked_by: user.id,
    agency_id: await getActiveAgencyId(supabase, user.id),
    provider: "quote_request",
    trip_type: d.tripType,
    origin_iata: d.origin,
    destination_iata: d.destination,
    depart_at: new Date(`${d.departDate}T09:00:00Z`).toISOString(),
    return_at: d.returnDate ? new Date(`${d.returnDate}T09:00:00Z`).toISOString() : null,
    cabin_class: d.cabinClass,
    status: "pending",
    total_price: 0,
    currency: "USD",
    raw_payload: {
      passengers: d.adults,
      contact_phone: d.contactPhone,
      notes: d.notes ?? null,
      requested_at: new Date().toISOString(),
    },
  });

  if (error) return { error: error.message };
  return { error: null, success: true };
}
