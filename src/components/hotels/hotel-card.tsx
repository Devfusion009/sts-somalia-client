import Link from "next/link";
import { Building2, MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";

export type HotelCardData = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country_code: string;
  star_rating: number | null;
  minPrice: number | null;
  currency: string;
};

export function HotelCard({ hotel }: { hotel: HotelCardData }) {
  return (
    <Link href={`/hotels/${hotel.slug}`} className="group block">
      <Card className="overflow-hidden py-0 transition-shadow hover:shadow-lg">
        <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-40 w-full" />
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-lg font-semibold leading-tight group-hover:text-primary">
              {hotel.name}
            </h3>
            {hotel.star_rating ? (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Star className="size-3 fill-brand-gold text-brand-gold" />
                {hotel.star_rating}
              </Badge>
            ) : null}
          </div>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {hotel.city}, {hotel.country_code}
          </p>
          {hotel.minPrice !== null ? (
            <p className="pt-1 text-sm">
              <span className="font-semibold text-foreground">
                {hotel.currency} {hotel.minPrice.toFixed(0)}
              </span>{" "}
              <span className="text-muted-foreground">/ night</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
