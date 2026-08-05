import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  ChevronRight,
  Home,
  MapPin,
  Ruler,
  Star,
  Users,
} from "lucide-react";
import { getHotelBySlug } from "@/modules/hotels/queries";
import { hotelImageUrls, amenityLabel } from "@/modules/hotels/images";
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

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const [{ slug }, { checkIn = "", checkOut = "", guests = "" }] = await Promise.all([
    params,
    searchParams,
  ]);
  const hotel = await getHotelBySlug(slug);
  if (!hotel) notFound();

  const rooms = hotel.hotel_rooms.filter((room) => room.status === "published");
  const amenities = Array.isArray(hotel.amenities) ? (hotel.amenities as string[]) : [];
  const images = hotelImageUrls(hotel.images);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/hotels" className="hover:text-foreground">
          Hotels
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{hotel.name}</span>
      </nav>

      {/* Gallery */}
      {images.length > 1 ? (
        <div className="grid h-64 grid-cols-4 gap-2 overflow-hidden rounded-2xl sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt={hotel.name} className="col-span-4 h-full w-full object-cover sm:col-span-2 sm:row-span-2" />
          <div className="col-span-4 hidden grid-cols-2 gap-2 sm:col-span-2 sm:grid">
            {images.slice(1, 5).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={`${hotel.name} photo ${i + 2}`} className="h-full w-full object-cover" />
            ))}
            {images.length < 5
              ? Array.from({ length: 5 - images.length }).map((_, i) => (
                  <MediaPlaceholder key={i} seed={`${hotel.id}-${i}`} icon={Building2} className="h-full w-full" />
                ))
              : null}
          </div>
        </div>
      ) : images.length === 1 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[0]} alt={hotel.name} className="h-64 w-full rounded-2xl object-cover sm:h-80" />
      ) : (
        <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-56 w-full rounded-2xl sm:h-72" />
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">{hotel.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-4" />
            {hotel.address_line ? `${hotel.address_line}, ` : ""}
            {hotel.city}, {hotel.country_code}
          </p>
        </div>
        {hotel.star_rating ? (
          <Badge variant="secondary" className="gap-1 text-base">
            <Star className="size-4 fill-brand-gold text-brand-gold" />
            {hotel.star_rating}-star hotel
          </Badge>
        ) : null}
      </div>

      {hotel.description ? (
        <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{hotel.description}</p>
      ) : null}

      {amenities.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {amenities.map((amenity) => (
            <Badge key={amenity} variant="outline">
              {amenityLabel(amenity)}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-heading text-2xl font-bold">Choose your room</h2>
        <p className="text-sm text-muted-foreground">
          {rooms.length} room type{rooms.length === 1 ? "" : "s"}
        </p>
      </div>

      {rooms.length > 0 ? (
        <div className="mt-4 space-y-4">
          {rooms.map((room) => {
            const roomImages = hotelImageUrls(room.images);
            const roomAmenities = Array.isArray(room.amenities)
              ? (room.amenities as string[])
              : [];
            return (
              <Card key={room.id} className="overflow-hidden py-0">
                <CardContent className="flex flex-col gap-0 p-0 sm:flex-row">
                  {roomImages[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={roomImages[0]}
                      alt={room.name}
                      className="h-44 w-full object-cover sm:h-auto sm:w-56 lg:w-64"
                    />
                  ) : (
                    <MediaPlaceholder
                      seed={room.id}
                      icon={BedDouble}
                      className="h-44 w-full sm:h-auto sm:w-56 lg:w-64"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="font-heading text-lg font-bold">{room.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" /> Up to {room.max_occupancy} guests
                      </span>
                      {room.bed_type ? (
                        <span className="flex items-center gap-1">
                          <BedDouble className="size-3.5" /> {room.bed_type}
                        </span>
                      ) : null}
                      {room.size_sqm ? (
                        <span className="flex items-center gap-1">
                          <Ruler className="size-3.5" /> {room.size_sqm} m²
                        </span>
                      ) : null}
                    </div>
                    {room.description ? (
                      <p className="text-sm text-muted-foreground">{room.description}</p>
                    ) : null}
                    {roomAmenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {roomAmenities.slice(0, 5).map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                          >
                            {amenityLabel(a)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border p-5 sm:w-48 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l">
                    <p className="text-right">
                      <span className="font-heading text-xl font-bold text-primary">
                        {room.currency} {room.base_price.toFixed(0)}
                      </span>
                      <span className="block text-xs text-muted-foreground">per night</span>
                    </p>
                    <BookingForm
                      hotelId={hotel.id}
                      room={room}
                      defaults={{ checkIn, checkOut, guests }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-muted-foreground">No rooms are currently available at this hotel.</p>
      )}
    </div>
  );
}
