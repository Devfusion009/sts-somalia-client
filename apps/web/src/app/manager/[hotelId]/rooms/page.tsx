import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CalendarDays, Users } from "lucide-react";
import { HotelWorkspaceHeader, hotelStyles as styles } from "@/modules/hotels/components/hotel-workspace";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { money } from "@/lib/money";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { getHotelAvailability, todayIso } from "@/modules/hotels/availability";
import { AvailabilityBoard } from "@/modules/hotels/components/availability-board";
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

  const totalUnits = hotel.hotel_rooms.reduce((sum, room) => sum + (room.total_units ?? 0), 0);
  const uncounted = hotel.hotel_rooms.some((room) => room.total_units === null);

  return (
    <div className={styles.workspace}>
      <HotelWorkspaceHeader title="Rooms & availability" eyebrow="Inventory management"
        meta={<span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"><BedDouble className="size-3.5" aria-hidden="true" />{totalUnits}{uncounted ? "+" : ""} rooms · {hotel.hotel_rooms.length} types</span>}
        actions={canEditRooms ? <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} /> : undefined}
      />

      <section className="space-y-3" aria-labelledby="availability-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="availability-heading" className="font-heading text-base font-semibold">Availability calendar</h2>
          <span className="text-xs text-muted-foreground">7-night view</span>
        </div>
        <AvailabilityBoard rooms={availability} from={from} days={7} today={todayIso()}
          roomHref={canSetAvailability ? (roomId) => `/manager/${hotel.id}/rooms/${roomId}` : undefined}
          rangeHref={(start) => `/manager/${hotel.id}/rooms?from=${start}`}
        />
      </section>

      <section className={styles.surface} aria-labelledby="room-types-heading">
        <div className={styles.sectionHeading}>
          <h2 id="room-types-heading">Room catalogue</h2>
          <span className="text-xs text-muted-foreground">{hotel.hotel_rooms.length} room types</span>
        </div>
        {hotel.hotel_rooms.length === 0 ? (
          <Empty><EmptyMedia variant="icon"><BedDouble /></EmptyMedia><EmptyTitle>No rooms</EmptyTitle></Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/30 text-[11px] font-medium text-muted-foreground">
                <tr><th scope="col" className="sticky left-0 z-10 bg-card px-5 py-3 font-medium">Room type</th><th scope="col" className="px-4 py-3 font-medium">Inventory</th><th scope="col" className="px-4 py-3 font-medium">Guests</th><th scope="col" className="px-4 py-3 font-medium">Base rate</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hotel.hotel_rooms.map((room) => (
                  <tr key={room.id} className="transition-colors hover:bg-secondary/30">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-4 text-left font-medium">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary/50 text-primary"><BedDouble className="size-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          {canSetAvailability ? <Link href={`/manager/${hotel.id}/rooms/${room.id}`} className="block whitespace-nowrap rounded-sm text-sm font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50">{room.name}</Link> : <span className="block whitespace-nowrap text-sm font-semibold">{room.name}</span>}
                          {room.floor ? <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{room.floor}</span> : null}
                        </div>
                      </div>
                    </th>
                    <td className="px-4 py-4 text-xs tabular-nums">{room.total_units === null ? <Badge variant="warning">Count not set</Badge> : <span><strong className="font-semibold">{room.total_units}</strong><span className="ml-1 text-muted-foreground">rooms</span></span>}</td>
                    <td className="px-4 py-4"><span className="flex items-center gap-1.5 text-xs tabular-nums"><Users className="size-3.5 text-muted-foreground" aria-hidden="true" />{room.max_occupancy}</span></td>
                    <td className="px-4 py-4"><span className="block whitespace-nowrap text-xs font-semibold tabular-nums">{money(room.base_price, room.currency)}</span><span className="mt-1 block text-[10px] text-muted-foreground">per night</span></td>
                    <td className="px-4 py-4"><Badge variant={statusBadgeVariant(room.status)} className="capitalize">{room.status.replace(/_/g, " ")}</Badge></td>
                    <td className="px-5 py-4"><div className="flex items-center justify-end gap-2">
                      {canSetAvailability ? <Button variant="outline" size="sm" render={<Link href={`/manager/${hotel.id}/rooms/${room.id}`} />}><CalendarDays aria-hidden="true" /><span className="hidden xl:inline">Calendar</span></Button> : null}
                      {canEditRooms ? <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} /> : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
