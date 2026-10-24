import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateSpan, money } from "@/lib/money";
import { BedDouble, CalendarCheck, ChevronRight, ExternalLink } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getHotelByIdAdmin, getHotelBookingsForHotel, getHotelPartnersForSelect } from "@/modules/admin/queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
import { getHotelManagers } from "@/modules/hotels/manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { PropertyReviews } from "@/components/admin/property-reviews";
import { uploadHotelImages, removeHotelImage, setHotelCoverImage } from "@/modules/admin/property-gallery-actions";
import { HotelForm } from "../hotel-form";
import { RoomDialog } from "./room-form";
import { HotelManagersSection } from "@/modules/hotels/components/manager-form";
import { HotelBookingPriceForm } from "../hotel-booking-controls";
import { BookingMoveActions } from "@/modules/hotels/components/booking-move-actions";
import { updateHotelBookingStatus } from "@/modules/admin/actions";
import { pipelineStatus, PIPELINE_BADGE_VARIANT } from "@/modules/bookings/pipeline-status";
import { HotelLogo } from "@/modules/hotels/components/hotel-logo";
import { HotelTabs } from "./hotel-tabs";

export const metadata: Metadata = { title: "Manage Hotel" };

function boardFrom(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayIso();
}

export default async function AdminHotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const from = boardFrom((await searchParams).from);
  const hotel = await getHotelByIdAdmin(id);
  if (!hotel) notFound();
  const bookings = await getHotelBookingsForHotel(id);
  const roomTypes = await getRoomTypes();
  const partners = await getHotelPartnersForSelect();
  const managers = await getHotelManagers(id);
  const availability = await getHotelAvailability(id, { from, days: 7 });

  const images = Array.isArray(hotel.images) ? hotel.images.filter((p): p is string => typeof p === "string") : [];
  const meta = [hotel.city, hotel.partner?.name ?? "STS (direct)", hotel.star_rating ? `${hotel.star_rating}★` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <BackLink href="/admin/hotels" label="All hotels" />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <HotelLogo path={hotel.logo_path} className="max-sm:size-12" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{hotel.name}</h1>
                <Badge variant={statusBadgeVariant(hotel.status)} className="capitalize">
                  {hotel.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {meta}
                <span className="capitalize"> · {hotel.booking_mode} booking</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <HotelForm hotel={hotel} partners={partners} />
          </div>
        </header>

        <StatRail>
          <StatRailItem label="Rooms" value={hotel.hotel_rooms.length} />
          <StatRailItem label="Bookings" value={bookings.length} />
          <StatRailItem label="Managers" value={managers.length} />
          <StatRailItem label="Photos" value={images.length} />
        </StatRail>

        <HotelTabs id={id} active="overview" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {hotel.partner ? (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-semibold">Partner</h2>
                {hotel.partnerAccountId ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Open partner account"
                    title="Open partner account"
                    render={<Link href={`/admin/partners/hotel-partner/${hotel.partnerAccountId}`} />}
                  >
                    <ExternalLink />
                  </Button>
                ) : null}
              </div>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Business</dt>
                  <dd className="truncate text-sm font-medium">{hotel.partner.name}</dd>
                </div>
                {hotel.partner.contact_email ? (
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="truncate text-sm font-medium">
                      <a href={`mailto:${hotel.partner.contact_email}`} className="hover:underline">
                        {hotel.partner.contact_email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {hotel.partner.contact_phone ? (
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="truncate text-sm font-medium tabular-nums">{hotel.partner.contact_phone}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <HotelManagersSection hotelId={hotel.id} managers={managers} />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Photos &amp; media</h2>
        <GalleryManager
          id={hotel.id}
          paths={images}
          bucket="hotel-images"
          uploadAction={uploadHotelImages}
          removeAction={removeHotelImage}
          setCoverAction={setHotelCoverImage}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Availability</h2>
        <AvailabilityBoard
          rooms={availability}
          from={from}
          days={7}
          today={todayIso()}
          roomHref={(roomId) => `/admin/hotels/${hotel.id}/rooms/${roomId}`}
          rangeHref={(start) => `/admin/hotels/${hotel.id}?from=${start}`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Rooms</h2>
          <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} />
        </div>
        <Card className="overflow-hidden py-0">
          {hotel.hotel_rooms.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <BedDouble />
              </EmptyMedia>
              <EmptyTitle>No rooms</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead numeric>Count</TableHead>
                  <TableHead numeric>Sleeps</TableHead>
                  <TableHead numeric>Price / night</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotel.hotel_rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>
                      <Link
                        href={`/admin/hotels/${hotel.id}/rooms/${room.id}`}
                        className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {room.name}
                      </Link>
                      {room.bed_type || room.floor ? (
                        <p className="text-xs text-muted-foreground">
                          {[room.bed_type, room.floor ? `Floor ${room.floor}` : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell numeric>
                      {room.total_units === null ? (
                        <Badge variant="warning">Not set</Badge>
                      ) : (
                        room.total_units
                      )}
                    </TableCell>
                    <TableCell numeric>{room.max_occupancy}</TableCell>
                    <TableCell numeric>
                      {room.base_price > 0 ? (
                        money(room.base_price, room.currency)
                      ) : (
                        <span className="text-muted-foreground">On request</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(room.status)} className="capitalize">
                        {room.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <div className="flex justify-end gap-1">
                        <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${room.name} availability and photos`}
                          title="Availability & photos"
                          render={<Link href={`/admin/hotels/${hotel.id}/rooms/${room.id}`} />}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Bookings</h2>
        <Card className="overflow-hidden py-0">
          {bookings.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <CalendarCheck />
              </EmptyMedia>
              <EmptyTitle>No bookings</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead numeric>Price</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const orderStatus = booking.order_item?.[0]?.order?.status ?? null;
                  const stage = pipelineStatus(orderStatus, booking.status);
                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <Link
                          href={`/admin/hotels/${id}/bookings/${booking.id}`}
                          className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {booking.customer?.full_name ?? booking.customer?.email ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{booking.room?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {dateSpan(booking.check_in, booking.check_out)}
                      </TableCell>
                      <TableCell numeric>
                        {hotel.booking_mode === "manual" && (orderStatus === "pending_payment" || orderStatus === "held") ? (
                          <HotelBookingPriceForm
                            bookingId={booking.id}
                            price={Number(booking.total_price)}
                            currency={booking.currency}
                          />
                        ) : (
                          <span className="tabular-nums">{money(booking.total_price, booking.currency)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PIPELINE_BADGE_VARIANT[stage]}>{stage}</Badge>
                      </TableCell>
                      <TableCell numeric>
                        <BookingMoveActions
                          bookingId={booking.id}
                          status={booking.status}
                          checkIn={booking.check_in}
                          today={todayIso()}
                          action={updateHotelBookingStatus}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Reviews</h2>
        <PropertyReviews hotelId={hotel.id} reviews={hotel.property_reviews} />
      </section>
    </div>
  );
}
