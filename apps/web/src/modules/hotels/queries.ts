import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";
import { hotelImageUrls } from "@/modules/hotels/images";
import { searchHotelbedsAvailability } from "@/lib/provider-runtime/hotelbeds";
import { cachedRead } from "@/lib/redis";

function toCardData(hotel: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  country_code: string;
  star_rating: number | null;
  amenities: unknown;
  images: unknown;
  booking_mode: string;
  hotel_rooms: { base_price: number; currency: string }[];
}): HotelCardData {
  const prices = hotel.hotel_rooms.map((r) => r.base_price);
  return {
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    description: hotel.description,
    city: hotel.city,
    country_code: hotel.country_code,
    star_rating: hotel.star_rating,
    amenities: Array.isArray(hotel.amenities)
      ? (hotel.amenities as unknown[]).filter((a): a is string => typeof a === "string")
      : [],
    image: hotelImageUrls(hotel.images)[0] ?? null,
    minPrice: prices.length ? Math.min(...prices) : null,
    currency: hotel.hotel_rooms[0]?.currency ?? "USD",
    bookingMode: hotel.booking_mode === "instant" ? "instant" : "manual",
  };
}

const CARD_SELECT =
  "id, slug, name, description, city, country_code, star_rating, amenities, images, booking_mode, hotel_rooms(base_price, currency)";

// Marketing pages render this on every load with no filters — a good,
// simple cache-aside target: published hotels don't change minute to
// minute. Cached under the "hotels" tag, which every admin, partner and
// manager hotel edit clears; the TTL is the safety net. Read with the
// signed-out client so the cached list never depends on who asked. Nothing
// date-dependent is cached: the live third-party blend in searchHotels() and
// rooms left for a stay stay uncached, since stale there means showing a
// room that is no longer bookable.
const HOTEL_TTL_SECONDS = 120;

export async function getFeaturedHotels(limit = 4): Promise<HotelCardData[]> {
  return cachedRead(
    `hotels:featured:${limit}`,
    HOTEL_TTL_SECONDS,
    async () => {
      const { data, error } = await createAnonClient()
        .from("hotels")
        .select(CARD_SELECT)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toCardData);
    },
    { tags: ["hotels"] }
  );
}

/** Published hotels matching a city (all when empty), best rated first. Same for every visitor. */
async function listPublishedHotels(cityName: string | undefined): Promise<HotelCardData[]> {
  const needle = cityName?.trim().toLowerCase().slice(0, 60) ?? "";
  return cachedRead(
    `hotels:list:${needle || "all"}`,
    HOTEL_TTL_SECONDS,
    async () => {
      let query = createAnonClient().from("hotels").select(CARD_SELECT).eq("status", "published");
      if (needle) query = query.ilike("city", `%${needle}%`);
      // nullsFirst: false — Postgres' default for DESC is NULLS FIRST, which
      // ranks unrated hotels ahead of 5-star ones. Explicit here so a hotel
      // missing a star rating sorts to the back of the list, not the front.
      const { data, error } = await query
        .order("star_rating", { ascending: false, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return (data ?? []).map(toCardData);
    },
    // A city nobody has is not stored: typed search terms must not fill the cache.
    { tags: ["hotels"], cacheIf: (value) => Array.isArray(value) && value.length > 0 }
  );
}

export async function searchHotels(filters: {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
}): Promise<HotelCardData[]> {
  // The city field carries whatever the autocomplete suggestion read, e.g.
  // "Bosaso, Puntland, Somalia" — hotels.city only ever holds the bare city
  // name, so matching the full string can never hit a row (the needle is
  // longer than the haystack). Match on the city segment alone.
  const cityName = filters.city?.split(",")[0]?.trim();

  const internal = await listPublishedHotels(cityName);

  // Blend in live external-supplier availability — only meaningful with a
  // city and stay dates, same as any real hotel search. Failures here never
  // break the page; internal listings still render.
  if (cityName && filters.checkIn && filters.checkOut) {
    const external = await searchHotelbedsAvailability({
      city: cityName,
      checkIn: filters.checkIn,
      checkOut: filters.checkOut,
      adults: filters.adults ?? 2,
    });
    const externalCards: HotelCardData[] = external.offers.map((offer) => ({
      id: offer.id,
      slug: offer.id,
      name: offer.name,
      description: null,
      city: offer.city,
      country_code: "",
      star_rating: offer.starRating,
      amenities: [],
      image: null,
      minPrice: offer.minPrice,
      currency: offer.currency,
      externalSource: "Hotelbeds",
    }));
    return [...internal, ...externalCards];
  }

  return internal;
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/** One published hotel with rooms, links and reviews. Rooms left and dated prices are read live elsewhere. */
export async function getHotelBySlug(slug: string) {
  if (!SLUG.test(slug)) return null;
  return cachedRead(
    `hotels:slug:${slug}`,
    HOTEL_TTL_SECONDS,
    async () => {
      const { data, error } = await createAnonClient()
        .from("hotels")
        .select(
          "id, slug, name, description, description_so, address_line, city, country_code, star_rating, amenities, images, status, booking_mode, phone, contact_email, check_in_time, check_out_time, policies, property_links(label, url, sort_order), property_reviews(id, author_name, rating, body, created_at), hotel_rooms(id, name, name_so, description, description_so, max_occupancy, bed_type, size_sqm, amenities, images, base_price, currency, status, total_units)"
        )
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    { tags: ["hotels"], cacheIf: (value) => value !== null }
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Units left per room for a stay, from the database ledger (capacity minus
 * every held booking, per night, minimum across the stay). A room missing
 * from the map has no tracked night in the range — not sold out.
 */
export async function getRoomAvailability(
  roomIds: string[],
  checkIn: string,
  checkOut: string
): Promise<Map<string, number>> {
  const availability = new Map<string, number>();
  if (
    roomIds.length === 0 ||
    !DATE_RE.test(checkIn) ||
    !DATE_RE.test(checkOut) ||
    checkOut <= checkIn
  ) {
    return availability;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("room_units_left", {
    p_room_ids: roomIds.slice(0, 50),
    p_check_in: checkIn,
    p_check_out: checkOut,
  });

  for (const row of data ?? []) {
    availability.set(row.room_id, row.units_left);
  }
  return availability;
}
