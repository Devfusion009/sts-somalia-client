import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Building2, ChevronRight, Home, MapPin, Ruler, ShieldCheck, Star, Users } from "lucide-react";
import { getHotelBySlug } from "@/modules/hotels/queries";
import { hotelImageUrls, amenityLabel } from "@/modules/hotels/images";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";
import { BookingReviewForm } from "./booking-review-form";

export const metadata: Metadata = { title: "Review your booking" };

export default async function HotelBookingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ roomId?: string; checkIn?: string; checkOut?: string; guests?: string; rooms?: string }>;
}) {
  const [{ slug }, { roomId, checkIn, checkOut, guests, rooms }] = await Promise.all([params, searchParams]);
  const hotel = await getHotelBySlug(slug);
  if (!hotel) notFound();

  const room = hotel.hotel_rooms.find((r) => r.id === roomId && r.status === "published");
  if (!room) redirect(`/hotels/${slug}`);

  const bookingMode = hotel.booking_mode === "instant" ? "instant" : "manual";
  const hotelImage = hotelImageUrls(hotel.images)[0];
  const roomImages = hotelImageUrls(room.images);
  const roomAmenities = Array.isArray(room.amenities) ? (room.amenities as string[]) : [];

  const hotelSummary = (
    <Card>
      <CardContent className="flex gap-4 pt-6">
        {hotelImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hotelImage} alt={hotel.name} className="size-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <MediaPlaceholder seed={hotel.id} icon={Building2} className="size-20 shrink-0 rounded-lg" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate font-heading text-lg font-bold">{hotel.name}</h2>
            {hotel.star_rating ? (
              <span className="flex shrink-0" aria-label={`${hotel.star_rating} star hotel`}>
                {Array.from({ length: hotel.star_rating }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-brand-gold text-brand-gold" />
                ))}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {hotel.address_line ? `${hotel.address_line}, ` : ""}
              {hotel.city}, {hotel.country_code}
            </span>
          </p>
          {bookingMode === "manual" ? (
            <Badge variant="outline" className="mt-2 text-muted-foreground">
              Booking on request
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const roomSummary = (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex flex-col gap-0 p-0 sm:flex-row">
        {roomImages[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={roomImages[0]} alt={room.name} className="h-40 w-full object-cover sm:h-auto sm:w-48" />
        ) : (
          <MediaPlaceholder seed={room.id} icon={BedDouble} className="h-40 w-full sm:h-auto sm:w-48" />
        )}
        <div className="flex-1 space-y-2 p-5">
          <h2 className="font-heading text-lg font-bold">{room.name}</h2>
          {room.name_so ? <p className="-mt-1.5 text-sm text-muted-foreground">{room.name_so}</p> : null}
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
          {room.description ? <p className="text-sm text-muted-foreground">{room.description}</p> : null}
          {roomAmenities.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {roomAmenities.slice(0, 8).map((a) => (
                <span key={a} className="flex items-center gap-1.5 text-xs text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {amenityLabel(a)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`/hotels/${slug}`} className="hover:text-foreground">
          {hotel.name}
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">Review your booking</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold tracking-tight lg:text-3xl">Review your booking</h1>

      <div className="mt-6">
        <BookingReviewForm
          hotelId={hotel.id}
          room={room}
          bookingMode={bookingMode}
          defaults={{ checkIn, checkOut, guests, numRooms: rooms }}
          hotelSummary={hotelSummary}
          roomSummary={roomSummary}
          bookedForSlot={<AgencyBookingSlot />}
        />
      </div>
    </div>
  );
}
