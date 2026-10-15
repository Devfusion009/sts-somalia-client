import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomDialog } from "@/app/partner/(portal)/hotels/[id]/room-form";

export const metadata = { title: "Rooms & Availability" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "destructive",
};

function boardFrom(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayIso();
}

export default async function ManagerRoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { hotelId } = await params;
  const from = boardFrom((await searchParams).from);
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const hotel = await getHotelForEdit(hotelId, [hotelId]);
  if (!hotel) notFound();
  const roomTypes = await getRoomTypes();
  const availability = await getHotelAvailability(hotelId, { from, days: 7 });

  const canEditRooms = hasPermission(managed, "rooms");
  const canSetAvailability = hasPermission(managed, "availability");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Availability</h2>
        <AvailabilityBoard
          rooms={availability}
          from={from}
          days={7}
          today={todayIso()}
          roomHref={canSetAvailability ? (roomId) => `/manager/${hotel.id}/rooms/${roomId}` : undefined}
          rangeHref={(start) => `/manager/${hotel.id}/rooms?from=${start}`}
        />
      </section>

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
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BedDouble className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{room.name}</p>
                      <Badge variant={STATUS_VARIANT[room.status] ?? "secondary"} className="shrink-0 capitalize">
                        {room.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {room.total_units === null ? "Count not set" : `${room.total_units} rooms`} · Up to {room.max_occupancy} guests · {room.currency} {room.base_price.toFixed(0)} / night
                      {room.floor ? ` · Floor ${room.floor}` : ""}
                    </p>
                  </div>
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
