import Link from "next/link";
import { Building2, MapPin, Star, ArrowRight, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { amenityLabel } from "@/modules/hotels/images";

export type HotelCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  country_code: string;
  star_rating: number | null;
  amenities: string[];
  image: string | null;
  minPrice: number | null;
  currency: string;
  /** 'manual' hotels are request-based (no live availability, STS confirms); 'instant' pay at checkout. */
  bookingMode?: "manual" | "instant";
  /** Set for results pulled live from an admin-activated third-party supplier (e.g. Hotelbeds) rather than our own partner listings. */
  externalSource?: string;
};

export function HotelCard({ hotel }: { hotel: HotelCardData }) {
  const isExternal = !!hotel.externalSource;

  const body = (
    <Card className={`flex h-full flex-col overflow-hidden py-0 transition-all ${isExternal ? "" : "group-hover:-translate-y-0.5 group-hover:shadow-lg"}`}>
      <div className="relative">
        {hotel.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hotel.image}
            alt={hotel.name}
            className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-44 w-full" />
        )}
        {hotel.star_rating ? (
          <Badge className="absolute top-3 right-3 gap-1 border-transparent bg-background/95 text-foreground shadow-sm">
            <Star className="size-3 fill-brand-gold text-brand-gold" />
            {hotel.star_rating}-star
          </Badge>
        ) : null}
        {isExternal ? (
          <Badge variant="outline" className="absolute top-3 left-3 gap-1 border-transparent bg-background/95 text-muted-foreground shadow-sm">
            <Globe className="size-3" />
            via {hotel.externalSource}
          </Badge>
        ) : hotel.bookingMode === "manual" ? (
          // Not connected to a live API — bookings are requests STS confirms
          // by hand, and the card must never suggest instant availability.
          <Badge variant="outline" className="absolute top-3 left-3 border-transparent bg-background/95 text-muted-foreground shadow-sm">
            Booking on request
          </Badge>
        ) : null}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-base font-bold leading-tight group-hover:text-primary">
          {hotel.name}
        </h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {hotel.city}, {hotel.country_code}
        </p>
        {hotel.amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {hotel.amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {amenityLabel(amenity)}
              </span>
            ))}
            {hotel.amenities.length > 3 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                +{hotel.amenities.length - 3} more
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between pt-2">
          {hotel.minPrice !== null && hotel.minPrice > 0 ? (
            <p className="text-sm">
              <span className="block text-[10px] text-muted-foreground uppercase">From</span>
              <span className="font-heading text-lg font-bold text-primary">
                {hotel.currency} {hotel.minPrice.toFixed(0)}
              </span>{" "}
              <span className="text-xs text-muted-foreground">/ night</span>
            </p>
          ) : hotel.minPrice === 0 ? (
            <p className="font-heading text-sm font-bold text-primary">Price on request</p>
          ) : (
            <span />
          )}
          {isExternal ? (
            <span className="text-xs text-muted-foreground">Contact us to book</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              View rooms <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isExternal) return <div className="h-full">{body}</div>;

  return (
    <Link href={`/hotels/${hotel.slug}`} className="group block h-full">
      {body}
    </Link>
  );
}
