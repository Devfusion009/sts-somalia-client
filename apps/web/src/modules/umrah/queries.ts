import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PackageCardData } from "@/modules/umrah/components/package-card";
import { umrahImageUrls } from "@/modules/umrah/images";

type PackageRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  tier: string | null;
  is_featured: boolean;
  origin_iata: string | null;
  destination_iata: string | null;
  duration_days: number;
  base_price: number;
  original_price: number | null;
  currency: string;
  includes: unknown;
  images: unknown;
  umrah_package_departures: { departure_date: string; total_seats: number; booked_seats: number; offline_seats: number }[];
  umrah_package_hotels: { city: string; name: string; star_rating: number | null; distance_to_haram_m: number | null }[];
};

const CARD_SELECT =
  "id, slug, name, tagline, tier, is_featured, origin_iata, destination_iata, duration_days, base_price, original_price, currency, includes, images, umrah_package_departures(departure_date, total_seats, booked_seats, offline_seats), umrah_package_hotels(city, name, star_rating, distance_to_haram_m)";

function toCardData(pkg: PackageRow): PackageCardData {
  const upcoming = pkg.umrah_package_departures
    .filter((d) => new Date(d.departure_date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date));

  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    tagline: pkg.tagline,
    tier: pkg.tier,
    isFeatured: pkg.is_featured,
    originIata: pkg.origin_iata,
    destinationIata: pkg.destination_iata,
    duration_days: pkg.duration_days,
    base_price: pkg.base_price,
    originalPrice: pkg.original_price === null ? null : Number(pkg.original_price),
    currency: pkg.currency,
    includes: Array.isArray(pkg.includes)
      ? (pkg.includes as unknown[]).filter((i): i is string => typeof i === "string")
      : [],
    images: umrahImageUrls(pkg.images),
    hotels: pkg.umrah_package_hotels ?? [],
    nextDeparture: upcoming[0] ?? null,
  };
}

/**
 * The packages shown in the landing page's "Upcoming Umrah packages" band.
 *
 * Ordered by is_featured first, then price. This function previously ordered by
 * created_at alone and never looked at is_featured at all — which meant the
 * landing row silently became "the four most recently added packages", so
 * publishing a new one pushed a curated package off the homepage. With a
 * catalog of four that was invisible; it stops being invisible the moment the
 * catalog grows.
 *
 * Price ascending as the tiebreak so the row reads as a ladder from the entry
 * package upwards, rather than in whatever order rows happened to be inserted.
 */
export async function getFeaturedPackages(limit = 4): Promise<PackageCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select(CARD_SELECT)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("base_price", { ascending: true })
    .limit(limit);

  return (data ?? []).map(toCardData);
}

export async function getAllPackages(): Promise<PackageCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select(CARD_SELECT)
    .eq("status", "published")
    .order("base_price");

  return (data ?? []).map(toCardData);
}

export async function getPackageBySlug(slug: string) {
  const supabase = await createClient();
  // Lazy backstop for the unpaid-seat sweep: release this package's stale
  // unpaid bookings before its seat counts are read.
  const { data: pkgId } = await supabase.from("umrah_packages").select("id").eq("slug", slug).maybeSingle();
  if (pkgId) await supabase.rpc("release_stale_umrah_seats", { p_package_id: pkgId.id });

  const { data } = await supabase
    .from("umrah_packages")
    .select(
      `id, slug, name, description, tagline, tier, is_featured, origin_iata, destination_iata,
       duration_days, includes, images, base_price, original_price, currency, status,
       meal_plan, meals_note, contact_person_name, contact_person_phone, contact_person_email, contact_whatsapp,
       umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, offline_seats, price_override, sales_close_days, status,
         outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
         return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
       umrah_package_hotels(id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order),
       umrah_itinerary_days(id, day_number, title, description),
       umrah_package_pricing(id, sharing, price)`
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data;
}

/**
 * Departures still on sale, soonest first: open, and departing after the
 * departure's own sales cutoff (departure_date - sales_close_days > today).
 * create_umrah_group_booking applies the same rule on the server.
 */
export function bookableDepartures<
  T extends { departure_date: string; sales_close_days?: number | null; status?: string | null },
>(departures: T[]): T[] {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return departures
    .filter((d) => (d.status ?? "open") === "open")
    .filter((d) => {
      const [y, m, day] = d.departure_date.split("-").map(Number);
      const close = new Date(Date.UTC(y, m - 1, day - (d.sales_close_days ?? 0))).toISOString().slice(0, 10);
      return close > today;
    })
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date));
}
