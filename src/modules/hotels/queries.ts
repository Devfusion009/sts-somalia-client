import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";
import { hotelImageUrls } from "@/modules/hotels/images";
import { searchHotelbedsAvailability } from "@/lib/provider-runtime/hotelbeds";

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
  };
}

const CARD_SELECT =
  "id, slug, name, description, city, country_code, star_rating, amenities, images, hotel_rooms(base_price, currency)";

export async function getFeaturedHotels(limit = 4): Promise<HotelCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(CARD_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toCardData);
}

export async function searchHotels(filters: {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
}): Promise<HotelCardData[]> {
  const supabase = await createClient();
  let query = supabase.from("hotels").select(CARD_SELECT).eq("status", "published");

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  const { data } = await query.order("star_rating", { ascending: false }).order("name");
  const internal = (data ?? []).map(toCardData);

  // Blend in live external-supplier availability — only meaningful with a
  // city and stay dates, same as any real hotel search. Failures here never
  // break the page; internal listings still render.
  if (filters.city && filters.checkIn && filters.checkOut) {
    const external = await searchHotelbedsAvailability({
      city: filters.city,
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
      "id, slug, name, description, address_line, city, country_code, star_rating, amenities, images, status, hotel_rooms(id, name, description, max_occupancy, bed_type, size_sqm, amenities, images, base_price, currency, status)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Remaining units per room for a stay: min(total - booked) across the
 * stay's capped nights (hotel_room_inventory is public-readable). A room
 * missing from the map has no caps in the range — treat as unrestricted.
 * Nights are check_in (inclusive) to check_out (exclusive), matching the
 * reservation trigger in the DB.
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
  const { data } = await supabase
    .from("hotel_room_inventory")
    .select("room_id, total_units, booked_units")
    .in("room_id", roomIds)
    .gte("date", checkIn)
    .lt("date", checkOut);

  for (const row of data ?? []) {
    const left = row.total_units - row.booked_units;
    const current = availability.get(row.room_id);
    availability.set(row.room_id, current === undefined ? left : Math.min(current, left));
  }
  return availability;
}
