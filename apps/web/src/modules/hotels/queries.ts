import "server-only";
import { createClient } from "@/lib/supabase/server";
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
// minute, so a short TTL trades a little staleness for cutting repeat
// Supabase load. searchHotels() below is NOT cached the same way — it
// blends in live third-party availability tied to specific dates, where
// stale results mean showing a room that's no longer bookable.
export async function getFeaturedHotels(limit = 4): Promise<HotelCardData[]> {
  return cachedRead(`hotels:featured:${limit}`, 300, async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("hotels")
      .select(CARD_SELECT)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map(toCardData);
  });
}

export async function searchHotels(filters: {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
}): Promise<HotelCardData[]> {
  const supabase = await createClient();
  let query = supabase.from("hotels").select(CARD_SELECT).eq("status", "published");

  // The city field carries whatever the autocomplete suggestion read, e.g.
  // "Bosaso, Puntland, Somalia" — hotels.city only ever holds the bare city
  // name, so matching the full string can never hit a row (the needle is
  // longer than the haystack). Match on the city segment alone.
  const cityName = filters.city?.split(",")[0]?.trim();

  if (cityName) {
    query = query.ilike("city", `%${cityName}%`);
  }

  // nullsFirst: false — Postgres' default for DESC is NULLS FIRST, which
  // ranks unrated hotels ahead of 5-star ones. Explicit here so a hotel
  // missing a star rating sorts to the back of the list, not the front.
  const { data } = await query
    .order("star_rating", { ascending: false, nullsFirst: false })
    .order("name");
  const internal = (data ?? []).map(toCardData);

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

export async function getHotelBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(
      "id, slug, name, description, description_so, address_line, city, country_code, star_rating, amenities, images, status, booking_mode, phone, contact_email, check_in_time, check_out_time, policies, property_links(label, url, sort_order), property_reviews(id, author_name, rating, body, created_at), hotel_rooms(id, name, name_so, description, description_so, max_occupancy, bed_type, size_sqm, amenities, images, base_price, currency, status, total_units)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data;
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
