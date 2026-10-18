import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CalendarPlus, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getRoomForInventory, getRoomUnits, getRoomBlocks, getRoomBookings, getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const availabilityByRoom = Object.fromEntries(availability.map((a) => [a.roomId, a.nights]));
  // Always include the room this page is on, even if it isn't published — an
  // unpublished type can't drop out of the picker while you're actively
  // managing it here. Every other published type is offered alongside it.
  const roomTypes = (hotel?.hotel_rooms ?? [])
    .filter((r) => r.status === "published" || r.id === room.id)
    .map((r) => ({ id: r.id, name: r.name, currency: r.currency, basePrice: Number(r.base_price) }));
  const canEditRooms = hasPermission(managed, "rooms");
  const canEditBookings = hasPermission(managed, "bookings");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <BackLink href={`/manager/${hotelId}/rooms`} label="Rooms" className="mb-3" />
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">{room.name}</h1>
          {room.total_units === null ? (
            <Badge variant="outline" className="text-muted-foreground">Count not set</Badge>
          ) : (
            <Badge variant="secondary">{room.total_units} rooms</Badge>
          )}
        </div>
      </div>

      {room.total_units === null ? (
        <Alert>
          <AlertCircle />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>Room count not set.</span>
            {canEditRooms ? (
              <Button size="sm" variant="outline" className="h-7 gap-1.5" render={<Link href={`/manager/${hotelId}/rooms`} />}>
                <Pencil className="size-3.5" /> Edit room
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarPlus className="size-4" />
            </span>
            Bookings
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

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Next 60 nights</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <RoomNightsTable nights={nights} currency={room.currency} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomUnitsManager hotelId={hotelId} roomTypeId={room.id} units={roomUnits} blocks={roomBlocks} canEdit={canEditRooms} />
        </CardContent>
      </Card>
    </div>
  );
}
