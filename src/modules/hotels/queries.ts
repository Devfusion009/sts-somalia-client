import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";
import { hotelImageUrls } from "@/modules/hotels/images";

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

export async function searchHotels(filters: { city?: string }): Promise<HotelCardData[]> {
  const supabase = await createClient();
  let query = supabase.from("hotels").select(CARD_SELECT).eq("status", "published");

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  const { data } = await query.order("star_rating", { ascending: false }).order("name");
  return (data ?? []).map(toCardData);
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
