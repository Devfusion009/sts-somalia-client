import Link from "next/link";
import { Building2 } from "lucide-react";
import { StarIcon, LocationOnIcon } from "@/components/ui/mui-icons";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Badge } from "@/components/ui/badge";
import { HotelAmenitiesList } from "@/modules/hotels/components/hotel-amenities-list";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";

/**
 * Wide result row — image left, detail centre, price + CTA right.
 * This is the search-results presentation from the reference layout, used
 * instead of the square grid card once someone is actually browsing results.
 *
 * Star class shows once, beside the name. The old right-hand "score box"
 * repeated it twice more (number tile + "N-star class"); the platform has no
 * guest review score to put there, so the column now carries price + CTA only.
 */
export function HotelListRow({ hotel, bookingSuffix = "" }: { hotel: HotelCardData; bookingSuffix?: string }) {
  const isExternal = !!hotel.externalSource;
  const href = `/hotels/${hotel.slug}${bookingSuffix}`;

  return (
    <article className="group grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow duration-200 hover:shadow-md sm:grid-cols-[210px_1fr] lg:grid-cols-[210px_1fr_190px]">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        {hotel.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image
          <img
            src={hotel.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-full"
          />
        ) : (
          <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-40 w-full sm:h-full" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-heading text-lg leading-snug font-bold">
            {isExternal ? (
              hotel.name
            ) : (
              <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {hotel.name}
              </Link>
            )}
          </h3>
          {hotel.star_rating ? (
            <span className="flex" role="img" aria-label={`${hotel.star_rating} star hotel`}>
              {Array.from({ length: hotel.star_rating }).map((_, i) => (
                <StarIcon key={i} sx={{ fontSize: 15 }} className="text-brand-gold" />
              ))}
            </span>
          ) : null}
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <LocationOnIcon sx={{ fontSize: 14 }} aria-hidden />
          {hotel.city}, {hotel.country_code}
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

      <div className="flex items-end justify-between gap-3 border-t border-border pt-3 sm:col-span-2 lg:col-span-1 lg:flex-col lg:justify-end lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
        <div className="lg:text-right">
          {hotel.minPrice !== null ? (
            <>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-heading text-xl font-extrabold tabular-nums">
                {hotel.currency} {Math.round(hotel.minPrice).toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground">per night</p>
            </>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Price on request</p>
          )}
        </div>

        <div className="shrink-0">

          {isExternal ? (
            <span className="block text-xs font-medium text-muted-foreground">Contact us to book</span>
          ) : (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 sm:h-10 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              View rooms
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
