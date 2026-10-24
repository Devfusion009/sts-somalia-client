import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getRoomForInventory, getRoomUnits, getRoomBlocks, getRoomBookings, getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { getNightRates } from "@/modules/hotels/rates";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
import { RoomUnitsManager } from "@/modules/hotels/components/room-units-manager";
import { OfflineBookingPanel } from "@/modules/hotels/components/offline-booking-panel";
import { InventoryRangeForm, ClearInventoryForm } from "@/app/partner/(portal)/hotels/[id]/rooms/[roomId]/inventory-form";

export const metadata = { title: "Room Availability" };

export default async function ManagerRoomInventoryPage({
  params,
}: {
  params: Promise<{ hotelId: string; roomId: string }>;
}) {
  const { hotelId, roomId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "availability")) notFound();

  const room = await getRoomForInventory(roomId, hotelId, [hotelId]);
  if (!room) notFound();

  const [hotel, availability, roomUnits, roomBlocks, bookings] = await Promise.all([
    getHotelForEdit(hotelId, [hotelId]),
    // No roomId filter: one call returns every room type's nights, so the
    // offline-booking form's room-type picker can show live availability
    // for whichever type is selected, not just this page's own room.
    getHotelAvailability(hotelId, { days: 60 }),
    getRoomUnits(room.id, hotelId, [hotelId]),
    getRoomBlocks(room.id, hotelId, [hotelId]),
    getRoomBookings(room.id, hotelId, [hotelId]),
  ]);
  const nights = availability.find((a) => a.roomId === room.id)?.nights ?? [];
  const rates = await getNightRates(await createClient(), room, nights.map((n) => n.night));
  const availabilityByRoom = Object.fromEntries(availability.map((a) => [a.roomId, a.nights]));
  // Always include the room this page is on, even if it isn't published — an
  // unpublished type can't drop out of the picker while you're actively
  // managing it here. Every other published type is offered alongside it.
  const roomTypes = (hotel?.hotel_rooms ?? [])
    .filter((r) => r.status === "published" || r.id === room.id)
    .map((r) => ({ id: r.id, name: r.name, currency: r.currency, basePrice: Number(r.base_price) }));
  const canEditRooms = hasPermission(managed, "rooms");
  const canEditBookings = hasPermission(managed, "bookings");

  const meta = [room.bed_type, room.floor ? `Floor ${room.floor}` : null, room.size_sqm ? `${room.size_sqm} m²` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-5">
        <header className="flex min-w-0 items-start gap-3">
          <BackLink href={`/manager/${hotelId}/rooms`} label="Rooms" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{room.name}</h1>
              <Badge variant={statusBadgeVariant(room.status)} className="capitalize">
                {room.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
          </div>
        </header>
        <StatRail>
          <StatRailItem
            label="Rooms"
            value={room.total_units ?? "Not set"}
            tone={room.total_units === null ? "warn" : undefined}
          />
          <StatRailItem label="Sleeps" value={room.max_occupancy} />
          <StatRailItem
            label="Base rate"
            value={Number(room.base_price) > 0 ? money(room.base_price, room.currency) : "On request"}
          />
          <StatRailItem label="Live bookings" value={bookings.length} />
        </StatRail>
      </div>

      {room.total_units === null ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Room count not set.</span>
            {canEditRooms ? (
              <Button size="sm" variant="outline" render={<Link href={`/manager/${hotelId}/rooms`} />}>
                <Pencil aria-hidden="true" /> Edit room
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Bookings
              <Badge variant="secondary" className="tabular-nums">
                {bookings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OfflineBookingPanel
              hotelId={hotelId}
              roomTypes={roomTypes}
              defaultRoomTypeId={room.id}
              availabilityByRoom={availabilityByRoom}
              bookings={bookings}
              canEdit={canEditBookings}
              newBookingHref={`/manager/${hotelId}/bookings/new?room=${room.id}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rooms</CardTitle>
            <CardAction>
              <Badge variant="secondary" className="tabular-nums">
                {roomUnits.length}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RoomUnitsManager hotelId={hotelId} roomTypeId={room.id} units={roomUnits} blocks={roomBlocks} canEdit={canEditRooms} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border pt-4 pb-3">
          <CardTitle className="text-base">Next 60 nights</CardTitle>
        </CardHeader>
        <RoomNightsTable nights={nights} currency={room.currency} rates={rates} />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Override dates</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryRangeForm hotelId={hotelId} roomId={room.id} currency={room.currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clear overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <ClearInventoryForm hotelId={hotelId} roomId={room.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
