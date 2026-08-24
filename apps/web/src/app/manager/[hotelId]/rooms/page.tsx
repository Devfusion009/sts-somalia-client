import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomDialog } from "@/app/partner/hotels/[id]/room-form";

export const metadata = { title: "Rooms & Availability" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "destructive",
};

export default async function ManagerRoomsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const hotel = await getHotelForEdit(hotelId, [hotelId]);
  if (!hotel) notFound();
  const roomTypes = await getRoomTypes();

  const canEditRooms = hasPermission(managed, "rooms");
  const canSetAvailability = hasPermission(managed, "availability");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            Rooms
            <Badge variant="secondary">{hotel.hotel_rooms.length}</Badge>
          </CardTitle>
          {canEditRooms ? <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} /> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {hotel.hotel_rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms yet.</p>
          ) : (
            hotel.hotel_rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{room.name}</p>
                    <Badge variant={STATUS_VARIANT[room.status] ?? "secondary"} className="capitalize">
                      {room.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Up to {room.max_occupancy} guests · {room.currency} {room.base_price.toFixed(0)} / night
                    {room.floor ? ` · Floor ${room.floor}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canSetAvailability ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      render={<Link href={`/manager/${hotel.id}/rooms/${room.id}`} />}
                    >
                      <CalendarDays className="size-3.5" /> Availability
                    </Button>
                  ) : null}
                  {canEditRooms ? <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} /> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
