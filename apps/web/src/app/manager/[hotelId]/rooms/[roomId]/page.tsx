import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getRoomForInventory } from "@/modules/hotels/partner-queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
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

  const [availability] = await getHotelAvailability(hotelId, { roomId: room.id, days: 60 });
  const nights = availability?.nights ?? [];
  const canEditRooms = hasPermission(managed, "rooms");

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
    </div>
  );
}
