import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Building2, MapPin, Star, Users } from "lucide-react";
import { getHotelBySlug } from "@/lib/data/hotels";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookingForm } from "./booking-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotelBySlug(slug);
  return { title: hotel?.name ?? "Hotel" };
}

export default async function HotelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await getHotelBySlug(slug);

  if (!hotel) notFound();

  const rooms = hotel.hotel_rooms.filter((room) => room.status === "published");
  const amenities = Array.isArray(hotel.amenities) ? (hotel.amenities as string[]) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-56 w-full rounded-2xl sm:h-72" />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold">{hotel.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-4" />
            {hotel.city}, {hotel.country_code}
          </p>
        </div>
        {hotel.star_rating ? (
          <Badge variant="secondary" className="gap-1 text-base">
            <Star className="size-4 fill-brand-gold text-brand-gold" />
            {hotel.star_rating}
          </Badge>
        ) : null}
      </div>

      {hotel.description ? <p className="mt-6 text-muted-foreground">{hotel.description}</p> : null}

      {amenities.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {amenities.map((amenity) => (
            <Badge key={amenity} variant="outline">
              {amenity}
            </Badge>
          ))}
        </div>
      ) : null}

      <h2 className="mt-10 font-heading text-2xl font-semibold">Rooms</h2>
      {rooms.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div>
                  <h3 className="font-heading text-lg font-semibold">{room.name}</h3>
                  {room.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="size-3.5" /> Up to {room.max_occupancy} guests
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-lg font-semibold text-foreground">
                    {room.currency} {room.base_price.toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground"> / night</span>
                  </p>
                  <BookingForm hotelId={hotel.id} room={room} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-muted-foreground">No rooms are currently available at this hotel.</p>
      )}
    </div>
  );
}
