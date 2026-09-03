import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getHotelByIdAdmin, getHotelBookingsForHotel, getHotelPartnersForSelect } from "@/modules/admin/queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
import { getHotelManagers } from "@/modules/hotels/manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { PropertyReviews } from "@/components/admin/property-reviews";
import { uploadHotelImages, removeHotelImage, setHotelCoverImage } from "@/modules/admin/property-gallery-actions";
import { HotelForm } from "../hotel-form";
import { RoomDialog } from "./room-form";
import { HotelManagersSection } from "@/modules/hotels/components/manager-form";
import { HotelBookingStatusSelect, HotelBookingPriceForm } from "../hotel-booking-controls";
import { pipelineStatus, PIPELINE_STATUS_STYLES } from "@/modules/bookings/pipeline-status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage Hotel" };

const HOTEL_STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

const ROOM_STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

export default async function AdminHotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotel = await getHotelByIdAdmin(id);
  if (!hotel) notFound();
  const bookings = await getHotelBookingsForHotel(id);
  const roomTypes = await getRoomTypes();
  const partners = await getHotelPartnersForSelect();
  const managers = await getHotelManagers(id);
  const availability = await getHotelAvailability(id, { days: 14 });

  const images = Array.isArray(hotel.images) ? hotel.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <BackLink href="/admin/hotels" label="All hotels" className="mb-3" />
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{hotel.name}</h1>
              <Badge className={cn("border-transparent capitalize", HOTEL_STATUS_STYLES[hotel.status] ?? "bg-muted text-muted-foreground")}>
                {hotel.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>{hotel.city}</span>
              <Divider />
              <span>{hotel.partner?.name ?? "STS (direct)"}</span>
              {hotel.star_rating ? (
                <>
                  <Divider />
                  <span>{hotel.star_rating}★</span>
                </>
              ) : null}
            </p>
          </div>
          <HotelForm hotel={hotel} partners={partners} />
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-secondary/40 px-4 py-3 text-sm">
          <Stat label="Rooms" value={hotel.hotel_rooms.length} />
          <Stat label="Bookings" value={bookings.length} />
          <Stat label="Managers" value={managers.length} />
          <Stat label="Photos" value={images.length} />
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {hotel.partner ? (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-heading text-sm font-semibold">Partner</h2>
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Business</dt>
                  <dd className="text-sm font-medium">{hotel.partner.name}</dd>
                </div>
                {hotel.partner.contact_email ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Contact</dt>
                    <dd className="text-sm font-medium">{hotel.partner.contact_email}</dd>
                  </div>
                ) : null}
                {hotel.partner.contact_phone ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="text-sm font-medium">{hotel.partner.contact_phone}</dd>
                  </div>
                ) : null}
              </dl>
              {hotel.partnerAccountId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  render={<Link href={`/admin/partners/hotel-partner/${hotel.partnerAccountId}`} />}
                >
                  View partner account <ArrowRight className="size-3.5" />
                </Button>
              ) : null}
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
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Availability</h2>
          <span className="text-xs text-muted-foreground">Next 14 nights · A agency · C customer</span>
        </div>
        <Card className="py-3">
          <CardContent className="px-3">
            <AvailabilityBoard rooms={availability} roomHref={(roomId) => `/admin/hotels/${hotel.id}/rooms/${roomId}`} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Rooms</h2>
          <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} />
        </div>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Price / night</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotel.hotel_rooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No rooms yet.
                  </TableCell>
                </TableRow>
              ) : (
                hotel.hotel_rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>
                      <p className="font-medium">{room.name}</p>
                      {room.bed_type || room.floor ? (
                        <p className="text-xs text-muted-foreground">
                          {[room.bed_type, room.floor ? `Floor ${room.floor}` : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {room.total_units === null ? (
                        <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
                      ) : (
                        room.total_units
                      )}
                    </TableCell>
                    <TableCell>{room.max_occupancy} guests</TableCell>
                    <TableCell>
                      {room.base_price > 0 ? `${room.currency} ${Number(room.base_price).toFixed(0)}` : "On request"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", ROOM_STATUS_STYLES[room.status] ?? "bg-muted text-muted-foreground")}>
                        {room.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          render={<Link href={`/admin/hotels/${hotel.id}/rooms/${room.id}`} />}
                        >
                          Availability &amp; photos <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Bookings</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No bookings yet for this hotel.
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => {
                  const orderStatus = booking.order_item?.[0]?.order?.status ?? null;
                  const stage = pipelineStatus(orderStatus, booking.status);
                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <p className="font-medium">{booking.customer?.full_name ?? booking.customer?.email ?? "—"}</p>
                      </TableCell>
                      <TableCell>{booking.room?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {booking.check_in} → {booking.check_out}
                      </TableCell>
                      <TableCell>
                        <HotelBookingPriceForm bookingId={booking.id} price={Number(booking.total_price)} currency={booking.currency} />
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border-transparent", PIPELINE_STATUS_STYLES[stage])}>{stage}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <HotelBookingStatusSelect bookingId={booking.id} status={booking.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Reviews</h2>
        <PropertyReviews hotelId={hotel.id} reviews={hotel.property_reviews} />
      </section>
    </div>
  );
}
