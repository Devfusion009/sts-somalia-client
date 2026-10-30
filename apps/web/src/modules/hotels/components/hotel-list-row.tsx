import Link from "next/link";
import { ArrowUpRight, Building2, MapPin, Star } from "lucide-react";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { HotelAmenitiesList } from "@/modules/hotels/components/hotel-amenities-list";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";
import styles from "@/components/marketing/travel-collection.module.css";

export function HotelListRow({ hotel, bookingSuffix = "" }: { hotel: HotelCardData; bookingSuffix?: string }) {
  const isExternal = !!hotel.externalSource;
  const href = `/hotels/${hotel.slug}${bookingSuffix}`;
  const photo = hotel.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- Supplier and Supabase images retain their original URLs.
    <img src={hotel.image} alt="" loading="lazy" decoding="async" />
  ) : <MediaPlaceholder seed={hotel.id} icon={Building2} className="absolute inset-0 size-full" />;

  return (
    <article className={styles.resultRow}>
      {isExternal ? <div className={styles.resultPhoto}>{photo}</div> : <Link href={href} target="_blank" rel="noopener noreferrer" className={`${styles.resultPhoto} focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary`} aria-label={`View ${hotel.name}`}>{photo}</Link>}
      <div className={styles.resultContent}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {hotel.star_rating ? <span className="inline-flex items-center gap-1 text-brand-gold" role="img" aria-label={`${hotel.star_rating} star hotel`}>{Array.from({ length: hotel.star_rating }, (_, i) => <Star key={i} className="size-3 fill-current" aria-hidden="true" />)}</span> : null}
          {hotel.bookingMode ? <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground">{hotel.bookingMode === "manual" ? "Request to book" : "Online booking"}</span> : null}
        </div>
        <h3 className="font-heading text-lg leading-snug font-semibold tracking-tight sm:text-xl">{isExternal ? hotel.name : <Link href={href} target="_blank" rel="noopener noreferrer" className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{hotel.name}</Link>}</h3>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{hotel.city}, {hotel.country_code}</div>
        {hotel.description ? <div className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{hotel.description}</div> : null}
        <HotelAmenitiesList amenities={hotel.amenities} limit={3} />
        {isExternal ? <span className="mt-2 text-[11px] text-muted-foreground">via {hotel.externalSource}</span> : null}
        <div className={styles.resultBottom}>
          <div>{hotel.minPrice !== null && hotel.minPrice > 0 ? <><span className="text-[10px] text-muted-foreground">From</span><div className="mt-0.5 flex flex-wrap items-baseline gap-1.5"><span className="text-xs font-medium text-muted-foreground">{hotel.currency}</span><span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">{Math.round(hotel.minPrice).toLocaleString("en-US")}</span><span className="text-[10px] text-muted-foreground">/ night</span></div></> : <span className="text-sm font-medium">Price on request</span>}</div>
          {isExternal ? <span className="text-xs text-muted-foreground">Contact us to book</span> : <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-4 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">View rooms<ArrowUpRight className="size-4" aria-hidden="true" /></Link>}
        </div>
      </div>
    </article>
  );
}
