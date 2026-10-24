import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CalendarDays, DoorOpen } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyHotelScope, getHotelForEdit, getHotelFrontDesk } from "@/modules/hotels/partner-queries";
import { getHotelManagers } from "@/modules/hotels/manager-queries";
import { hotelGuestNames } from "@/modules/orders/format";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money, shortDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { GalleryManager } from "@/components/admin/gallery-manager";
import {
  uploadHotelImagesPartner,
  removeHotelImagePartner,
  setHotelCoverImagePartner,
} from "@/modules/hotels/hotel-gallery-actions";
import { uploadHotelLogoPartner, removeHotelLogoPartner } from "@/modules/hotels/hotel-logo-actions";
import { hotelLogoUrl } from "@/modules/hotels/images";
import { HotelLogoUploader } from "@/components/admin/hotel-logo-uploader";
import { HotelManagersSection } from "@/modules/hotels/components/manager-form";
import { EditHotelForm } from "./edit-hotel-form";
import { RoomDialog } from "./room-form";

function boardFrom(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayIso();
}

export default async function EditHotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const from = boardFrom((await searchParams).from);
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  const hotel = await getHotelForEdit(id, scope.hotelIds);
  if (!hotel) notFound();
  const roomTypes = await getRoomTypes();
  // Editing the hotel's own core listing fields (name, address, star rating)
  // stays owning-partner-only — a hotel_manager (or a partner acting on a
  // hotel they don't themselves own, e.g. an STS-direct property they were
  // assigned to manage) runs rooms/bookings only, never this.
  const canEditHotel = scope.partnerId !== null && hotel.partner_id === scope.partnerId;

  // Photos are media, not core identity — the owning partner always has
  // them; a manager only when admin granted the 'photos' permission (see
  // hotel-gallery-actions.ts for the write-side check that actually matters).
  let canManagePhotos = canEditHotel;
  if (!canManagePhotos && scope.partnerId === null) {
    const supabase = await createClient();
    const { data: manager } = await supabase
      .from("hotel_managers")
      .select("permissions")
      .eq("hotel_id", id)
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    canManagePhotos = manager?.permissions.includes("photos") ?? false;
  }
  const images = Array.isArray(hotel.images) ? hotel.images.filter((p): p is string => typeof p === "string") : [];
  const frontDesk = await getHotelFrontDesk(id, scope.hotelIds);
  const managers = canEditHotel ? await getHotelManagers(id) : [];
  const availability = await getHotelAvailability(id, { from, days: 7 });

  const meta = [
    `${hotel.city}, ${hotel.country_code}`,
    hotel.star_rating ? `${hotel.star_rating}-star` : null,
    hotel.address_line,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-5">
        <header className="flex min-w-0 items-start gap-3">
          <BackLink href="/partner/hotels" label="My Hotels" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{hotel.name}</h1>
              <Badge variant={statusBadgeVariant(hotel.status)} className="capitalize">
                {hotel.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{meta}</p>
          </div>
        </header>
        <StatRail>
          <StatRailItem label="In house" value={frontDesk.inHouse.length} />
          <StatRailItem label="Arriving today" value={frontDesk.arrivingToday.length} />
          <StatRailItem label="Departing today" value={frontDesk.departingToday.length} />
          <StatRailItem label="Room types" value={hotel.hotel_rooms.length} />
        </StatRail>
      </div>

      <div className={cn("grid items-start gap-6", canEditHotel && "lg:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              In house
              <Badge variant="secondary" className="tabular-nums">
                {frontDesk.inHouse.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {frontDesk.inHouse.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <DoorOpen />
                </EmptyMedia>
                <EmptyTitle>No guests in house</EmptyTitle>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {frontDesk.inHouse.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{hotelGuestNames(booking.guest_details)[0] ?? "Guest"}</p>
                      <p className="truncate text-xs text-muted-foreground">{booking.hotel_rooms?.name}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground tabular-nums">Until {shortDate(booking.check_out)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canEditHotel ? (
          <Card>
            <CardContent>
              <HotelManagersSection hotelId={hotel.id} managers={managers} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Availability</h2>
        <AvailabilityBoard
          rooms={availability}
          from={from}
          days={7}
          today={todayIso()}
          roomHref={(roomId) => `/partner/hotels/${hotel.id}/rooms/${roomId}`}
          rangeHref={(start) => `/partner/hotels/${hotel.id}?from=${start}`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            Room types
            <Badge variant="secondary" className="tabular-nums">
              {hotel.hotel_rooms.length}
            </Badge>
          </h2>
          <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} />
        </div>
        <Card className="py-0">
          <CardContent className="p-0">
            {hotel.hotel_rooms.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <BedDouble />
                </EmptyMedia>
                <EmptyTitle>No rooms</EmptyTitle>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {hotel.hotel_rooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/partner/hotels/${hotel.id}/rooms/${room.id}`}
                          className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {room.name}
                        </Link>
                        <Badge variant={statusBadgeVariant(room.status)} className="shrink-0 capitalize">
                          {room.status.replace(/_/g, " ")}
                        </Badge>
                        {room.total_units === null ? <Badge variant="warning">Count not set</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {[
                          room.total_units === null ? null : `${room.total_units} rooms`,
                          `Sleeps ${room.max_occupancy}`,
                          `${money(room.base_price, room.currency)} / night`,
                          room.floor ? `Floor ${room.floor}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" render={<Link href={`/partner/hotels/${hotel.id}/rooms/${room.id}`} />}>
                        <CalendarDays aria-hidden="true" /> Availability
                      </Button>
                      <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {canEditHotel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hotel details</CardTitle>
          </CardHeader>
          <CardContent>
            <EditHotelForm hotel={hotel} />
          </CardContent>
        </Card>
      ) : null}

      {canManagePhotos ? (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <HotelLogoUploader
                hotelId={hotel.id}
                logoUrl={hotelLogoUrl(hotel.logo_path)}
                uploadAction={uploadHotelLogoPartner}
                removeAction={removeHotelLogoPartner}
              />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
              <CardAction>
                <Badge variant="secondary" className="tabular-nums">
                  {images.length}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <GalleryManager
                id={hotel.id}
                paths={images}
                bucket="hotel-images"
                uploadAction={uploadHotelImagesPartner}
                removeAction={removeHotelImagePartner}
                setCoverAction={setHotelCoverImagePartner}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
