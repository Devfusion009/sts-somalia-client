import Link from "next/link";
import { Building2 } from "lucide-react";
import { StarIcon, LocationOnIcon } from "@/components/ui/mui-icons";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Badge } from "@/components/ui/badge";
import { HotelAmenitiesList } from "@/modules/hotels/components/hotel-amenities-list";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";

/**
 * Wide result row — image left, detail centre, rating + price + CTA right.
 * This is the search-results presentation from the reference layout, used
 * instead of the square grid card once someone is actually browsing results.
 *
 * The rating badge shows the property's STAR CLASS, not a guest review score:
 * the platform has no review data yet, and rendering an invented "8.7" in the
 * reference's score box would be fabricating a number travellers rely on.
 */
const STAR_WORD: Record<number, string> = {
  5: "Luxury",
  4: "Upscale",
  3: "Comfort",
  2: "Value",
  1: "Basic",
};

export function HotelListRow({ hotel, bookingSuffix = "" }: { hotel: HotelCardData; bookingSuffix?: string }) {
  const isExternal = !!hotel.externalSource;
  const href = `/hotels/${hotel.slug}${bookingSuffix}`;

  return (
    <article className="group grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 transition-shadow duration-200 hover:shadow-lg sm:grid-cols-[210px_1fr] lg:grid-cols-[210px_1fr_190px]">
      <div className="relative overflow-hidden rounded-lg">
        {hotel.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image
          <img
            src={hotel.image}
            alt={hotel.name}
            className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-full"
          />
        ) : (
          <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-40 w-full sm:h-full" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-heading text-lg font-bold text-primary group-hover:underline">{hotel.name}</h3>
          {hotel.star_rating ? (
            <span className="flex" aria-label={`${hotel.star_rating} star hotel`}>
              {Array.from({ length: hotel.star_rating }).map((_, i) => (
                <StarIcon key={i} sx={{ fontSize: 15 }} className="text-brand-gold" />
              ))}
            </span>
          ) : null}
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs">
          <LocationOnIcon sx={{ fontSize: 14 }} className="text-muted-foreground" />
          <span className="font-medium text-primary underline-offset-2 hover:underline">
            {hotel.city}, {hotel.country_code}
          </span>
        </p>

        {hotel.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{hotel.description}</p>
        ) : null}

        <HotelAmenitiesList amenities={hotel.amenities} />

        {isExternal ? (
          <Badge variant="outline" className="mt-3 text-xs text-muted-foreground">
            via {hotel.externalSource}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-row items-end justify-between gap-3 border-t border-border pt-3 lg:flex-col lg:items-end lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
        {hotel.star_rating ? (
          <div className="flex items-center gap-2 lg:flex-row-reverse">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg rounded-bl-none bg-primary font-heading text-sm font-bold text-primary-foreground">
              {hotel.star_rating}
            </span>
            <span className="text-right lg:text-left">
              <span className="block text-xs font-bold">{STAR_WORD[hotel.star_rating] ?? "Rated"}</span>
              <span className="block text-[11px] text-muted-foreground">{hotel.star_rating}-star class</span>
            </span>
          </div>
        ) : (
          <span />
        )}

        <div className="text-right">
          {hotel.minPrice !== null ? (
            <>
              <p className="text-[11px] text-muted-foreground">From</p>
              <p className="font-heading text-xl font-extrabold">
                {hotel.currency} {hotel.minPrice.toFixed(0)}
              </p>
              <p className="text-[11px] text-muted-foreground">per night</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Price on request</p>
          )}

          {isExternal ? (
            <span className="mt-2 block text-xs font-medium text-muted-foreground">Contact us to book</span>
          ) : (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-9 items-center rounded-lg bg-brand-accent px-4 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              View rooms
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
