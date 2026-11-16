import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { MAX_BATCH_CUSTOMERS, type TravellerProfile } from "./traveller-profile";

export { MAX_BATCH_CUSTOMERS };

type TypedClient = SupabaseClient<Database>;

/**
 * Which client(s) the agent is currently serving at the counter.
 *
 * A cookie rather than a URL param because the desk spans several routes
 * (service picker → search → booking form) and a walk-in is served across
 * all of them in one sitting: threading ids through every link and form is
 * what made the old per-form <select> unusable at volume.
 *
 * Holds a comma-separated list, because one product is routinely booked for
 * several customers at once (a family on one hotel booking, 30 pilgrims on
 * one Umrah departure). One id is just the common case of that.
 *
 * Reads are always re-validated against the caller's own agency below — the
 * cookie value is client-controlled, so an id belonging to another agency
 * must drop out rather than leak that agency's client name.
 */
export const BOOKING_CUSTOMER_COOKIE = "sts_agent_booking_for";

/** A counter session lasts a working day, not a browser session. */
export const BOOKING_CUSTOMER_MAX_AGE = 60 * 60 * 12;

/**
 * The customer plus their saved traveller identity, so every booking step
 * starts from the profile instead of asking for it again.
 */
export type BookingCustomer = TravellerProfile & {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  profile_id: string | null;
};

export function parseBookingCustomerIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_BATCH_CUSTOMERS
  );
}

/**
 * Every selected customer, in the order they were picked. Empty when nothing
 * is selected or when none of the ids survive the agency check.
 */
export async function getBookingCustomers(
  supabase: TypedClient,
  agencyId: string
): Promise<BookingCustomer[]> {
  const store = await cookies();
  const ids = parseBookingCustomerIds(store.get(BOOKING_CUSTOMER_COOKIE)?.value);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("agency_customers")
    .select(
      "id, full_name, phone, email, profile_id, first_name, middle_name, last_name, gender, date_of_birth, nationality, passport_number, passport_issuing_country, passport_issue_date, passport_expiry_date, preferred_cabin"
    )
    .eq("agency_id", agencyId)
    .in("id", ids);

  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is BookingCustomer => Boolean(row));
}

/** The single selected customer, for the steps that only ever book for one. */
export async function getBookingCustomer(
  supabase: TypedClient,
  agencyId: string
): Promise<BookingCustomer | null> {
  const customers = await getBookingCustomers(supabase, agencyId);
  return customers[0] ?? null;
}
