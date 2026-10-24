import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { money } from "@/lib/money";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomDialog } from "@/app/partner/(portal)/hotels/[id]/room-form";

export const metadata = { title: "Rooms & Availability" };

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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Rooms & Availability" />

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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            Room types
            <Badge variant="secondary" className="tabular-nums">
              {hotel.hotel_rooms.length}
            </Badge>
          </h2>
          {canEditRooms ? <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} /> : null}
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
                        {canSetAvailability ? (
                          <Link
                            href={`/manager/${hotel.id}/rooms/${room.id}`}
                            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {room.name}
                          </Link>
                        ) : (
                          <p className="truncate font-medium">{room.name}</p>
                        )}
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
                      {canSetAvailability ? (
                        <Button variant="outline" render={<Link href={`/manager/${hotel.id}/rooms/${room.id}`} />}>
                          <CalendarDays aria-hidden="true" /> Availability
                        </Button>
                      ) : null}
                      {canEditRooms ? <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
