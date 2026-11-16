import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BedDouble,
  Clock,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Star,
  Users,
} from "lucide-react";
import { getHotelBySlug, getRoomAvailability } from "@/modules/hotels/queries";
import { hotelImageUrls } from "@/modules/hotels/images";
import { amenityDisplayLabel, amenityIcon, sortAmenities } from "@/modules/hotels/amenity-icons";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { PropertyLinks } from "@/components/property-links";
import { PropertyReviews } from "@/components/property-reviews";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getStayPrices } from "@/modules/hotels/rates";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { cn } from "@/lib/utils";
import { BookingForm } from "./booking-form";
import { StayDatesPicker } from "@/modules/hotels/components/stay-dates-picker";
import { OccupancyPicker } from "@/modules/hotels/components/occupancy-picker";
import { getRatePlans } from "@/modules/hotels/rate-plan-queries";
import {
  BOARD_LABEL,
  cancellationLabel,
  formatOccupancy,
  occupancyTotals,
  parseOccupancy,
  planStayPrice,
} from "@/modules/hotels/booking-options";
import { HotelGallery } from "./hotel-gallery";
import { hotelLocation } from "@/modules/hotels/location";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotelBySlug(slug);
  return { title: hotel?.name ?? "Hotel" };
}

const MAX_STAY_NIGHTS = 60;

/** Nights between two YYYY-MM-DD dates, or 0 when the pair isn't a bookable stay. */
function stayNights(checkIn: string, checkOut: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return 0;
  const n = Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
  return n > 0 && n <= MAX_STAY_NIGHTS ? n : 0;
}

/** Whole amounts without decimals, fractional ones to the cent — never round a charged figure away. */
function formatMoney(amount: number) {
  const cents = Math.round(amount * 100) / 100;
  return Number.isInteger(cents) ? cents.toFixed(0) : cents.toFixed(2);
}

/** "14:00:00" from the database → "14:00". */
function clockTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

/** "+252907700000" → "+252 907 700 000"; anything that is not a bare +digits number is shown as typed. */
function displayPhone(value: string) {
  const m = /^\+(\d{3})(\d+)$/.exec(value.replace(/[\s-]/g, ""));
  if (!m) return value;
  const groups = m[2].match(/.{1,3}/g) ?? [];
  return `+${m[1]} ${groups.join(" ")}`;
}

/** "Very good" wording bands, same thresholds Reviews.com/Booking-style scores use. */
function ratingWord(average: number) {
  if (average >= 4.5) return "Excellent";
  if (average >= 4) return "Very good";
  if (average >= 3) return "Good";
  return "Rated";
}

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; occ?: string }>;
}) {
  const [{ slug }, { checkIn = "", checkOut = "", guests = "", occ = "" }] = await Promise.all([
    params,
    searchParams,
  ]);
  const hotel = await getHotelBySlug(slug);
  if (!hotel) notFound();

  const rooms = hotel.hotel_rooms.filter((room) => room.status === "published");
  const amenities = Array.isArray(hotel.amenities) ? (hotel.amenities as string[]) : [];
  const images = hotelImageUrls(hotel.images);

  // Unpaid direct bookings older than 24 hours stop holding rooms before the
  // counts below are read, so a missed cron run never shows a room as taken.
  await createAdminClient().rpc("_expire_unpaid_stay_orders").then(
    () => null,
    () => null
  );

  // With dates selected, every room type shows how many rooms are left.
  // Rooms absent from the map have no room count set: shown as available.
  const availability = await getRoomAvailability(
    rooms.map((r) => r.id),
    checkIn,
    checkOut
  );

  const occupancy = parseOccupancy(occ, Number.parseInt(guests, 10) || undefined);
  const occTotals = occupancyTotals(occupancy);
  const occParam = formatOccupancy(occupancy);
  const ratePlans = await getRatePlans(hotel.id, { activeOnly: true });

  const priced = rooms.filter((r) => r.base_price > 0);
  const currency = priced[0]?.currency ?? "USD";

  // With valid dates, every price on the page is the stay's real price (rate
  // rules and per-date overrides included) — the base rate alone understates
  // or overstates what the review page and checkout will charge.
  const nights = stayNights(checkIn, checkOut);
  const stayPrices =
    nights > 0 && priced.length > 0
      ? await getStayPrices(await createClient(), priced, checkIn, checkOut)
      : new Map<string, { total: number }>();
  const minPrice =
    priced.length === 0
      ? null
      : stayPrices.size > 0
        ? Math.min(...priced.map((r) => stayPrices.get(r.id)?.total ?? r.base_price * nights))
        : Math.min(...priced.map((r) => r.base_price));
  const reviewCount = hotel.property_reviews.length;
  const averageRating =
    reviewCount > 0
      ? hotel.property_reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb className="mb-4" items={[{ label: "Hotels", href: "/hotels" }, { label: hotel.name }]} />

      <HotelGallery images={images} hotelId={hotel.id} hotelName={hotel.name} />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">{hotel.name}</h1>
                {hotel.star_rating ? (
                  <span className="flex" role="img" aria-label={`${hotel.star_rating} star hotel`}>
                    {Array.from({ length: hotel.star_rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-brand-gold text-brand-gold" aria-hidden />
                    ))}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground sm:text-base">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {hotelLocation(hotel)}
              </p>
            </div>
            {averageRating !== null ? (
              <a
                href="#reviews"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-foreground">{ratingWord(averageRating)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {reviewCount} review{reviewCount > 1 ? "s" : ""}
                  </span>
                </span>
              </a>
            ) : null}
          </div>

          {/* Phones get the price + jump-to-rooms up top; the full summary
              card sits in the sidebar from lg and at the page end below it. */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 pl-4 lg:hidden">
            <div className="min-w-0">
              {minPrice !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-heading text-lg leading-tight font-bold text-primary tabular-nums">
                    {currency} {formatMoney(minPrice)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {stayPrices.size > 0 ? `/ ${nights} night${nights === 1 ? "" : "s"}` : "/ night"}
                    </span>
                  </p>
                </>
              ) : (
                <p className="font-heading text-base font-bold text-primary">Price on request</p>
              )}
            </div>
            <a
              href="#rooms"
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-brand-accent px-5 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              View rooms
            </a>
          </div>

          {hotel.description ? (
            <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{hotel.description}</p>
          ) : null}
          {hotel.description_so ? (
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">{hotel.description_so}</p>
          ) : null}

          {amenities.length > 0 ? (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Amenities</h2>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {sortAmenities(amenities).map((amenity) => {
                  const Icon = amenityIcon(amenity);
                  return (
                    <span key={amenity} className="flex items-center gap-2 text-sm text-foreground">
                      <Icon sx={{ fontSize: 18 }} className="shrink-0 text-primary" aria-hidden />
                      {amenityDisplayLabel(amenity)}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hotel.policies ? (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Hotel policies</h2>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {hotel.policies}
              </p>
            </div>
          ) : null}

          <div id="rooms" className="mt-10 scroll-mt-24">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-2xl font-bold tracking-tight">Choose your room</h2>
              <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {rooms.length} room type{rooms.length === 1 ? "" : "s"}
              </p>
            </div>

            <form
              action={`/hotels/${slug}#rooms`}
              method="get"
              className="mt-4 grid grid-cols-1 items-end gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1.4fr_1fr_auto]"
            >
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="stay-dates">Dates</Label>
                <StayDatesPicker
                  id="stay-dates"
                  hotelId={hotel.id}
                  currency={currency}
                  defaultCheckIn={checkIn}
                  defaultCheckOut={checkOut}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="stay-guests">Guests</Label>
                <OccupancyPicker id="stay-guests" defaultValue={occupancy} />
              </div>
              <Button type="submit" size="lg">
                Check availability
              </Button>
            </form>

            {rooms.length > 0 ? (
              <div className="mt-4 space-y-4">
                {rooms.map((room) => {
                  const roomImages = hotelImageUrls(room.images);
                  const roomAmenities = Array.isArray(room.amenities)
                    ? (room.amenities as string[])
                    : [];
                  const unitsLeft = availability.get(room.id);
                  const soldOut = unitsLeft !== undefined && unitsLeft <= 0;
                  const enoughRooms = unitsLeft === undefined || unitsLeft >= occTotals.rooms;
                  const fits = occupancy.every((r) => r.adults + r.children <= room.max_occupancy);
                  const stayTotal = stayPrices.get(room.id)?.total;
                  const roomStay = stayTotal ?? room.base_price;
                  const priceNights = stayTotal !== undefined ? nights : 1;
                  const plans = room.base_price > 0 ? ratePlans : [];
                  const bookHref = (planId?: string) => {
                    const params = new URLSearchParams({ roomId: room.id, occ: occParam });
                    if (checkIn) params.set("checkIn", checkIn);
                    if (checkOut) params.set("checkOut", checkOut);
                    if (planId) params.set("plan", planId);
                    return `/hotels/${slug}/book?${params.toString()}`;
                  };
                  return (
                    <Card key={room.id} className="overflow-hidden py-0">
                      <CardContent className="flex flex-col gap-0 p-0 sm:flex-row">
                        {roomImages[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={roomImages[0]}
                            alt={room.name}
                            loading="lazy"
                            decoding="async"
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
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="font-heading text-lg font-bold">{room.name}</h3>
                            {nights > 0 ? (
                              <span
                                className={cn(
                                  "text-xs font-medium tabular-nums",
                                  soldOut ? "text-destructive" : "text-primary"
                                )}
                              >
                                {unitsLeft === undefined
                                  ? "Available"
                                  : soldOut
                                    ? "Fully booked"
                                    : `${unitsLeft} room${unitsLeft === 1 ? "" : "s"} left`}
                              </span>
                            ) : null}
                          </div>
                          {room.name_so ? (
                            <p className="-mt-1.5 text-sm text-muted-foreground">{room.name_so}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="size-3.5" aria-hidden /> Up to {room.max_occupancy} guests
                            </span>
                            {room.bed_type ? (
                              <span className="flex items-center gap-1">
                                <BedDouble className="size-3.5" aria-hidden /> {room.bed_type}
                              </span>
                            ) : null}
                            {room.size_sqm ? (
                              <span className="flex items-center gap-1">
                                <Ruler className="size-3.5" aria-hidden /> {room.size_sqm} m²
                              </span>
                            ) : null}
                          </div>
                          {room.description ? (
                            <p className="text-sm text-muted-foreground">{room.description}</p>
                          ) : null}
                          {room.description_so ? (
                            <p className="text-sm text-muted-foreground">{room.description_so}</p>
                          ) : null}
                          {roomAmenities.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {roomAmenities.slice(0, 5).map((a) => (
                                <span
                                  key={a}
                                  className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                                >
                                  {amenityDisplayLabel(a)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {plans.length > 0 && fits ? null : (
                        <div className="flex items-center justify-between gap-3 border-t border-border p-5 sm:w-48 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l">
                          <p className="sm:text-right">
                            {room.base_price > 0 && stayTotal !== undefined ? (
                              <>
                                <span className="font-heading text-xl font-bold text-primary tabular-nums">
                                  {room.currency} {formatMoney(stayTotal)}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {nights} night{nights === 1 ? "" : "s"}
                                </span>
                              </>
                            ) : room.base_price > 0 ? (
                              <>
                                <span className="font-heading text-xl font-bold text-primary tabular-nums">
                                  {room.currency} {formatMoney(room.base_price)}
                                </span>
                                <span className="block text-xs text-muted-foreground">per night</span>
                              </>
                            ) : (
                              <span className="font-heading text-base font-bold text-primary">
                                Price on request
                              </span>
                            )}
                          </p>
                          {!fits ? (
                            <Button size="lg" variant="outline" disabled>
                              Up to {room.max_occupancy} per room
                            </Button>
                          ) : plans.length > 0 ? null : room.base_price > 0 ? (
                            <BookingForm href={bookHref()} available={!soldOut && enoughRooms} />
                          ) : (
                            <WhatsAppInlineLink
                              message={`Hello, I would like a price for the ${room.name} at ${hotel.name}.`}
                              className={buttonVariants({ size: "lg", variant: "outline" })}
                            >
                              Ask for price
                            </WhatsAppInlineLink>
                          )}
                        </div>
                        )}
                      </CardContent>
                      {plans.length > 0 && fits ? (
                        <ul className="divide-y divide-border border-t border-border">
                          {plans.map((plan) => {
                            const price = planStayPrice({
                              roomStay,
                              rooms: occTotals.rooms,
                              nights: priceNights,
                              adults: occTotals.adults,
                              children: occTotals.children,
                              plan,
                            });
                            return (
                              <li
                                key={plan.id}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:flex-nowrap"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-heading text-sm font-bold tracking-wide uppercase">
                                    {BOARD_LABEL[plan.board]}
                                  </p>
                                  <p
                                    className={cn(
                                      "text-sm",
                                      plan.cancellation === "non_refundable" ? "text-muted-foreground" : "text-primary"
                                    )}
                                  >
                                    {cancellationLabel(plan, checkIn)}
                                  </p>
                                </div>
                                {plan.discountPercent > 0 ? (
                                  <Badge variant="info" className="tabular-nums">
                                    −{plan.discountPercent}%
                                  </Badge>
                                ) : null}
                                <p className="ml-auto text-right">
                                  {price.discount > 0 ? (
                                    <span className="block text-xs text-muted-foreground line-through tabular-nums">
                                      {room.currency} {formatMoney(price.roomsTotal + price.board)}
                                    </span>
                                  ) : null}
                                  <span className="font-heading text-lg font-bold text-primary tabular-nums">
                                    {room.currency} {formatMoney(price.total)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {stayTotal !== undefined
                                      ? `${nights} night${nights === 1 ? "" : "s"} · ${occTotals.rooms} room${occTotals.rooms === 1 ? "" : "s"}`
                                      : "per night"}
                                  </span>
                                </p>
                                <BookingForm href={bookHref(plan.id)} available={!soldOut && enoughRooms} />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Empty className="mt-4 border border-border bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BedDouble />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">No rooms available</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          <div id="reviews" className="mt-10 scroll-mt-24">
            <PropertyReviews reviews={hotel.property_reviews} />
          </div>
        </div>

        {/* Sticky summary — price, class and contact, so the numbers that
            matter travel with the page instead of living only in the room
            list further down. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="text-xs text-muted-foreground">
                  {minPrice !== null ? "Prices from" : "Pricing"}
                </p>
                {minPrice !== null ? (
                  <p className="font-heading text-2xl font-bold text-primary tabular-nums">
                    {currency} {formatMoney(minPrice)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {stayPrices.size > 0 ? `/ ${nights} night${nights === 1 ? "" : "s"}` : "/ night"}
                    </span>
                  </p>
                ) : (
                  <p className="font-heading text-lg font-bold text-primary">Price on request</p>
                )}
              </div>

              <a
                href="#rooms"
                className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-accent font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                View room options
              </a>

              <div className="space-y-2 border-t border-border pt-4 text-sm">
                {hotel.star_rating ? (
                  <p className="flex items-center gap-2 text-foreground">
                    <Star className="size-4 fill-brand-gold text-brand-gold" aria-hidden />
                    {hotel.star_rating}-star hotel
                  </p>
                ) : null}
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {hotel.address_line ? `${hotel.address_line}, ` : ""}
                  {hotelLocation(hotel)}
                </p>
                {hotel.phone ? (
                  <a
                    href={`tel:${hotel.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden /> {displayPhone(hotel.phone)}
                  </a>
                ) : null}
                {hotel.contact_email ? (
                  <a
                    href={`mailto:${hotel.contact_email}`}
                    className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden /> {hotel.contact_email}
                  </a>
                ) : null}
                {hotel.check_in_time || hotel.check_out_time ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4 shrink-0" aria-hidden />
                    {[
                      clockTime(hotel.check_in_time) ? `Check-in ${clockTime(hotel.check_in_time)}` : null,
                      clockTime(hotel.check_out_time) ? `Check-out ${clockTime(hotel.check_out_time)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>

              <PropertyLinks links={hotel.property_links} className="border-t border-border pt-4" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
