import { bookableDepartures, packageCardSchema, packageDetailSchema, type PackageCard, type PackageDetail } from "@sts/shared-types";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

/** Package row (with departures and hotels) → card DTO; next departure is the soonest still on sale. */
export function toPackageCard(pkg: Row, today: string): PackageCard {
  const upcoming = bookableDepartures((pkg.umrah_package_departures ?? []) as Array<Row & { departure_date: string }>, today);
  return packageCardSchema.parse({
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
    originalPrice: pkg.original_price,
    currency: pkg.currency,
    includes: stringList(pkg.includes),
    images: stringList(pkg.images),
    hotels: pkg.umrah_package_hotels ?? [],
    nextDeparture: upcoming[0] ?? null,
  });
}

export function toPackageDetail(row: Row): PackageDetail {
  return packageDetailSchema.parse(row);
}
