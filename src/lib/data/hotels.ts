import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HotelCardData } from "@/components/hotels/hotel-card";

function toCardData(hotel: {
  id: string;
  slug: string;
  name: string;
  city: string;
  country_code: string;
  star_rating: number | null;
  hotel_rooms: { base_price: number; currency: string }[];
}): HotelCardData {
  const prices = hotel.hotel_rooms.map((r) => r.base_price);
  return {
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    city: hotel.city,
    country_code: hotel.country_code,
    star_rating: hotel.star_rating,
    minPrice: prices.length ? Math.min(...prices) : null,
    currency: hotel.hotel_rooms[0]?.currency ?? "USD",
  };
}

export async function getFeaturedHotels(limit = 4): Promise<HotelCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select("id, slug, name, city, country_code, star_rating, hotel_rooms(base_price, currency)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toCardData);
}

export async function searchHotels(filters: { city?: string }): Promise<HotelCardData[]> {
  const supabase = await createClient();
  let query = supabase
    .from("hotels")
    .select("id, slug, name, city, country_code, star_rating, hotel_rooms(base_price, currency)")
    .eq("status", "published");

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  const { data } = await query.order("name");
  return (data ?? []).map(toCardData);
}

export async function getHotelBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotels")
    .select(
      "id, slug, name, description, city, country_code, star_rating, amenities, status, hotel_rooms(id, name, description, max_occupancy, base_price, currency, status)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data;
}
