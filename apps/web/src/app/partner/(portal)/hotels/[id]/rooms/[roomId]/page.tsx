import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
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
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
import { RoomUnitsManager } from "@/modules/hotels/components/room-units-manager";
import { OfflineBookingPanel } from "@/modules/hotels/components/offline-booking-panel";
import { InventoryRangeForm, ClearInventoryForm } from "./inventory-form";

export const metadata = { title: "Room Availability" };

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

  const meta = [room.bed_type, room.floor ? `Floor ${room.floor}` : null, room.size_sqm ? `${room.size_sqm} m²` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-5">
        <header className="flex min-w-0 items-start gap-3">
          <BackLink href={`/partner/hotels/${id}`} label={room.hotels.name} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{room.name}</h1>
              <Badge variant={statusBadgeVariant(room.status)} className="capitalize">
                {room.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{[room.hotels.name, meta].filter(Boolean).join(" · ")}</p>
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
            <Button size="sm" variant="outline" render={<Link href={`/partner/hotels/${id}`} />}>
              <Pencil aria-hidden="true" /> Edit room
            </Button>
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
              hotelId={id}
              roomTypes={roomTypes}
              defaultRoomTypeId={room.id}
              availabilityByRoom={availabilityByRoom}
              bookings={bookings}
              canEdit
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
            <RoomUnitsManager hotelId={id} roomTypeId={room.id} units={roomUnits} blocks={roomBlocks} canEdit />
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
    </div>
  );
}
