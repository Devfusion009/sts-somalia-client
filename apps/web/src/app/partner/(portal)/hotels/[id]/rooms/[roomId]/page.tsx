import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CalendarPlus, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import {
  getMyHotelScope,
  getRoomForInventory,
  getRoomUnits,
  getRoomBlocks,
  getRoomBookings,
  getHotelForEdit,
} from "@/modules/hotels/partner-queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { getNightRates } from "@/modules/hotels/rates";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
import { RoomUnitsManager } from "@/modules/hotels/components/room-units-manager";
import { OfflineBookingPanel } from "@/modules/hotels/components/offline-booking-panel";
import { InventoryRangeForm, ClearInventoryForm } from "./inventory-form";

export default async function RoomInventoryPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  const room = await getRoomForInventory(roomId, id, scope.hotelIds);
  if (!room) notFound();

  const [hotel, availability, roomUnits, roomBlocks, bookings] = await Promise.all([
    getHotelForEdit(id, scope.hotelIds),
    // No roomId filter: one call returns every room type's nights, so the
    // offline-booking form's room-type picker can show live availability
    // for whichever type is selected, not just this page's own room.
    getHotelAvailability(id, { days: 60 }),
    getRoomUnits(room.id, id, scope.hotelIds),
    getRoomBlocks(room.id, id, scope.hotelIds),
    getRoomBookings(room.id, id, scope.hotelIds),
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <BackLink href={`/partner/hotels/${id}`} label={room.hotels.name} className="mb-3" />
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
            <Button size="sm" variant="outline" className="h-7 gap-1.5" render={<Link href={`/partner/hotels/${id}`} />}>
              <Pencil className="size-3.5" /> Edit room
            </Button>
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
            hotelId={id}
            roomTypes={roomTypes}
            defaultRoomTypeId={room.id}
            availabilityByRoom={availabilityByRoom}
            bookings={bookings}
            canEdit
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Next 60 nights</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <RoomNightsTable nights={nights} currency={room.currency} rates={rates} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Override dates</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryRangeForm hotelId={id} roomId={room.id} currency={room.currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clear overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <ClearInventoryForm hotelId={id} roomId={room.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomUnitsManager hotelId={id} roomTypeId={room.id} units={roomUnits} blocks={roomBlocks} canEdit />
        </CardContent>
      </Card>
    </div>
  );
}
