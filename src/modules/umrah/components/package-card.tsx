import Link from "next/link";
import { Landmark, CalendarDays, Users, Clock3, ArrowRight, Plane, Building2 } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { INCLUDE_LABELS } from "@/modules/umrah/includes";
import { cn } from "@/lib/utils";

export { INCLUDE_LABELS };

export type PackageCardHotel = {
  city: string;
  name: string;
  star_rating: number | null;
  distance_to_haram_m: number | null;
};

export type PackageCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  tier: string | null;
  isFeatured: boolean;
  originIata: string | null;
  destinationIata: string | null;
  duration_days: number;
  base_price: number;
  originalPrice: number | null;
  currency: string;
  includes: string[];
  images: string[];
  hotels: PackageCardHotel[];
  nextDeparture: { departure_date: string; total_seats: number; booked_seats: number } | null;
};

const TIER_STYLES: Record<string, string> = {
  vip: "bg-brand-gold/15 text-brand-gold",
  premium: "bg-chart-4/10 text-chart-4",
  standard: "bg-chart-2/10 text-chart-2",
  economy: "bg-chart-3/10 text-chart-3",
};

/**
 * Tier is an admin-set field (umrah_packages.tier). It used to be guessed
 * at render time from substrings of the package name and price thresholds —
 * which meant admins had no way to control it and a renamed package silently
 * changed tier. The name/price fallback is kept only for packages created
 * before the field existed and not yet edited.
 */
/**
 * Display names for the stored tier values, which are lowercase slugs
 * (umrah_packages.tier). Rendering the slug straight into the badge printed
 * "vip" and "standard" in lowercase — the name-matching fallback below happened
 * to produce properly cased labels, so this only surfaced once real tiers were
 * set on the rows.
 */
const TIER_LABELS: Record<string, string> = {
  vip: "VIP",
  premium: "Premium",
  standard: "Standard",
  economy: "Economy",
};

export function packageTier(pkg: { name: string; base_price: number; tier?: string | null }) {
  const explicit = pkg.tier?.trim();
  if (explicit) {
    const key = explicit.toLowerCase();
    return {
      // Unknown tiers fall back to capitalising the slug rather than showing it
      // raw, so a value added by an admin later still reads as a label.
      label: TIER_LABELS[key] ?? explicit.charAt(0).toUpperCase() + explicit.slice(1),
      className: TIER_STYLES[key] ?? "bg-secondary text-secondary-foreground",
    };
  }
  const name = pkg.name.toLowerCase();
  if (name.includes("vip")) return { label: "VIP", className: TIER_STYLES.vip };
  if (name.includes("premium")) return { label: "Premium", className: TIER_STYLES.premium };
  if (name.includes("economy")) return { label: "Economy", className: TIER_STYLES.economy };
  if (pkg.base_price >= 2500) return { label: "VIP", className: TIER_STYLES.vip };
  if (pkg.base_price >= 1500) return { label: "Premium", className: TIER_STYLES.premium };
  return { label: "Economy", className: TIER_STYLES.economy };
}

export function discountPercent(base: number, original: number | null): number | null {
  if (!original || original <= base) return null;
  return Math.round(((original - base) / original) * 100);
}

function hotelFor(hotels: PackageCardHotel[], city: string) {
  return hotels.find((h) => h.city === city) ?? null;
}

function HotelLine({ label, hotel }: { label: string; hotel: PackageCardHotel }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Building2 className="size-3" /> {label}
      </p>
      {/* Wraps to two lines rather than truncating. In a four-up grid the
          column is ~110px wide, and "The Oberoi Madinah" truncated to
          "The Oberoi M…" tells a pilgrim nothing — the hotel name is one of the
          few things that actually distinguishes one package from another. */}
      <p className="line-clamp-2 text-sm leading-snug font-medium">{hotel.name}</p>
      {/* "5★ · 450m" rather than "★★★★★ · 450m from Haram": the column is about
          110px wide in a four-up grid, and the longer form simply truncated to
          "450m from …". A distance quoted against a Makkah or Madinah hotel is
          unambiguous, and the full phrasing stays in the tooltip. */}
      <p
        className="truncate text-xs text-muted-foreground"
        title={
          hotel.distance_to_haram_m ? `${hotel.distance_to_haram_m}m from the Haram` : undefined
        }
      >
        {hotel.star_rating ? (
          <span className="font-semibold text-brand-gold">{hotel.star_rating}★</span>
        ) : null}
        {hotel.star_rating && hotel.distance_to_haram_m ? " · " : null}
        {hotel.distance_to_haram_m ? `${hotel.distance_to_haram_m}m` : null}
      </p>
    </div>
  );
}

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const seatsLeft = pkg.nextDeparture ? pkg.nextDeparture.total_seats - pkg.nextDeparture.booked_seats : null;
  const tier = packageTier(pkg);
  const cover = pkg.images[0] ?? null;
  const discount = discountPercent(pkg.base_price, pkg.originalPrice);
  const makkah = hotelFor(pkg.hotels, "makkah");
  const madinah = hotelFor(pkg.hotels, "madinah");

  return (
    <Link href={`/umrah/${pkg.slug}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative">
          {cover ? (
            // Supabase Storage URL, not a local asset — next/image would need the
            // remote host allow-listed in next.config.ts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-40 w-full object-cover" />
          ) : (
            <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-40 w-full" />
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {pkg.isFeatured ? (
              <Badge className="border-transparent bg-brand-accent font-semibold text-brand-accent-foreground">
                Most Popular
              </Badge>
            ) : null}
            <Badge className={cn("border-transparent font-semibold", tier.className, "bg-card")}>{tier.label}</Badge>
          </div>
          {seatsLeft !== null && seatsLeft <= 10 ? (
            <Badge className="absolute top-3 right-3 gap-1 border-transparent bg-card text-brand-accent">
              <Users className="size-3" />
              {seatsLeft} seats left
            </Badge>
          ) : null}
        </div>
        <CardContent className="flex flex-1 flex-col gap-2.5 p-4">
          <div>
            <h3 className="font-heading text-base font-bold leading-tight group-hover:text-primary">{pkg.name}</h3>
            {pkg.tagline ? <p className="mt-0.5 text-xs text-muted-foreground">{pkg.tagline}</p> : null}
          </div>

          {pkg.originIata && pkg.destinationIata ? (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span>{pkg.originIata}</span>
              <span className="flex flex-1 items-center gap-1 text-muted-foreground">
                <span className="h-px flex-1 border-t border-dashed border-border" />
                <Plane className="size-3" />
                <span className="h-px flex-1 border-t border-dashed border-border" />
              </span>
              <span>{pkg.destinationIata}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" /> {pkg.duration_days}D / {Math.max(0, pkg.duration_days - 1)}N
            </span>
            {pkg.nextDeparture ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                Departs {format(new Date(pkg.nextDeparture.departure_date), "d MMM yyyy")}
              </span>
            ) : null}
          </div>

          {makkah || madinah ? (
            <div className="flex gap-3 rounded-lg bg-secondary/40 p-2">
              {makkah ? <HotelLine label="Makkah Hotel" hotel={makkah} /> : null}
              {makkah && madinah ? <span className="w-px shrink-0 bg-border" /> : null}
              {madinah ? <HotelLine label="Madinah Hotel" hotel={madinah} /> : null}
            </div>
          ) : null}

          {pkg.includes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pkg.includes.slice(0, 4).map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground"
                >
                  {INCLUDE_LABELS[item] ?? item}
                </span>
              ))}
              {pkg.includes.length > 4 ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  +{pkg.includes.length - 4} more
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto flex items-end justify-between pt-2">
            <p className="text-sm">
              <span className="block text-[10px] uppercase text-muted-foreground">Starting from</span>
              <span className="font-heading text-lg font-bold text-primary">
                {pkg.currency} {pkg.base_price.toFixed(0)}
              </span>{" "}
              <span className="text-xs text-muted-foreground">/ pilgrim</span>
              {discount ? (
                <span className="mt-0.5 block text-xs">
                  <span className="text-muted-foreground line-through">
                    {pkg.currency} {pkg.originalPrice?.toFixed(0)}
                  </span>{" "}
                  <span className="font-semibold text-primary">{discount}% OFF</span>
                </span>
              ) : null}
            </p>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              View package <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
