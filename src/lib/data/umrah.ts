import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PackageCardData } from "@/components/umrah/package-card";

type PackageRow = {
  id: string;
  slug: string;
  name: string;
  duration_days: number;
  base_price: number;
  currency: string;
  umrah_package_departures: { departure_date: string; total_seats: number; booked_seats: number }[];
};

function toCardData(pkg: PackageRow): PackageCardData {
  const upcoming = pkg.umrah_package_departures
    .filter((d) => new Date(d.departure_date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date));

  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    duration_days: pkg.duration_days,
    base_price: pkg.base_price,
    currency: pkg.currency,
    nextDeparture: upcoming[0] ?? null,
  };
}

export async function getFeaturedPackages(limit = 4): Promise<PackageCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select("id, slug, name, duration_days, base_price, currency, umrah_package_departures(departure_date, total_seats, booked_seats)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toCardData);
}

export async function getAllPackages(): Promise<PackageCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select("id, slug, name, duration_days, base_price, currency, umrah_package_departures(departure_date, total_seats, booked_seats)")
    .eq("status", "published")
    .order("name");

  return (data ?? []).map(toCardData);
}

export async function getPackageBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_packages")
    .select(
      "id, slug, name, description, duration_days, includes, base_price, currency, status, umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, price_override)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data;
}
