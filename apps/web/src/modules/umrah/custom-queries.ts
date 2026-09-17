import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UmrahService } from "@/modules/umrah/services";
import { toSharingPriceMap, type SharingPriceMap } from "@/modules/umrah/pricing";

const SERVICE_SELECT =
  "id, category, name, description, tier, price, currency, price_unit, star_rating, distance_to_haram_m, is_default, sort_order";

/**
 * The whole published service catalog, in display order.
 *
 * Fetched in one query rather than one per category: the builder renders every
 * category on a single screen and has to reprice ALL of them whenever the
 * party size or nights change, so it needs the full set in memory anyway.
 */
export async function getUmrahServices(): Promise<UmrahService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_services")
    .select(SERVICE_SELECT)
    .eq("status", "published")
    .order("category")
    .order("sort_order");

  return (data ?? []).map((s) => ({ ...s, price: Number(s.price) }));
}

/**
 * Occupancy prices (single/double/triple/quad) for published hotel services,
 * keyed by service id. Services without rows fall back to their base price.
 */
export async function getUmrahSharingPrices(): Promise<SharingPriceMap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_service_sharing_prices")
    .select("service_id, sharing, price, service:umrah_services!inner(status, category)")
    .eq("service.status", "published")
    .in("service.category", ["hotel_makkah", "hotel_madinah"]);

  return toSharingPriceMap(data ?? []);
}

/** Every service including drafts — the admin catalog screen. */
export async function getUmrahServicesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_services")
    .select(`${SERVICE_SELECT}, status, sharing_prices:umrah_service_sharing_prices(sharing, price)`)
    .order("category")
    .order("sort_order");

  return (data ?? []).map((s) => ({
    ...s,
    price: Number(s.price),
    sharing_prices: (s.sharing_prices ?? []).map((p) => ({
      sharing: p.sharing,
      price: Number(p.price),
    })),
  }));
}

const REQUEST_SELECT =
  `id, reference, status, current_step, tier, num_pilgrims, room_sharing, departure_date,
   nights_makkah, nights_madinah, notes, pilgrims, subtotal, currency, customer_id, booked_by,
   agency_id, created_at,
   services:umrah_custom_request_services(id, service_id, category, name, price_unit, unit_price, quantity, line_total)`;

export type UmrahCustomRequest = NonNullable<Awaited<ReturnType<typeof getUmrahCustomRequest>>>;

/** One request, RLS-scoped — the owner, its agency, or an admin. */
export async function getUmrahCustomRequest(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_custom_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    subtotal: Number(data.subtotal),
    services: (data.services ?? []).map((s) => ({
      ...s,
      unit_price: Number(s.unit_price),
      line_total: Number(s.line_total),
    })),
  };
}

/**
 * Submitted private requests awaiting a decision, oldest first — the same
 * strict FIFO promise the manual hotel/hall queue makes.
 */
export async function getSubmittedUmrahRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_custom_requests")
    .select(
      `${REQUEST_SELECT}, customer:profiles!umrah_custom_requests_customer_id_fkey(full_name, email, phone),
       booking:umrah_bookings!umrah_bookings_custom_request_id_fkey(id, status, total_price, currency)`
    )
    .eq("status", "submitted")
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    ...r,
    subtotal: Number(r.subtotal),
    services: (r.services ?? []).map((s) => ({
      ...s,
      unit_price: Number(s.unit_price),
      line_total: Number(s.line_total),
    })),
  }));
}

/**
 * The signed-in customer's most recent unfinished build, if any. Starting the
 * builder resumes this rather than stranding a half-priced draft they can no
 * longer reach.
 *
 * Returns enough to render a "resume this" summary card wherever a draft
 * needs to be surfaced (the private-Umrah landing page, the account bookings
 * list) — not just the id, which is all a redirect-only resume needed before
 * a draft had anywhere it could be shown from outside the builder itself.
 */
export async function getMyDraftUmrahRequest(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_custom_requests")
    .select(
      "id, reference, current_step, tier, num_pilgrims, departure_date, nights_makkah, nights_madinah, subtotal, currency, updated_at"
    )
    .eq("booked_by", profileId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { ...data, subtotal: Number(data.subtotal) };
}
