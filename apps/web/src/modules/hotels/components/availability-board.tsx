import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RoomAvailability, RoomNight } from "@/modules/hotels/availability";

function cellTone(night: RoomNight) {
  if (night.capacity === null) return "bg-muted/40 text-muted-foreground";
  if (night.available !== null && night.available <= 0) return "bg-destructive/10 text-destructive";
  if (night.available !== null && night.available <= Math.max(1, Math.ceil(night.capacity * 0.2))) {
    return "bg-brand-gold/15 text-brand-gold";
  }
  return "bg-primary/5 text-foreground";
}

/**
 * Rooms × nights grid: each cell is rooms left / capacity, with the agency /
 * customer split beneath. The same board serves the admin, partner and
 * manager consoles — the RPC behind it is what decides who may see a hotel.
 */
export function AvailabilityBoard({
  rooms,
  roomHref,
}: {
  rooms: RoomAvailability[];
  roomHref?: (roomId: string) => string;
}) {
  if (rooms.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No rooms yet.</p>;
  }
  const nights = rooms[0].nights;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-40 bg-card py-2 pr-3 text-left font-medium text-muted-foreground">
              Room
            </th>
            {nights.map((n) => {
              const date = new Date(`${n.night}T00:00:00`);
              const weekend = date.getDay() === 5 || date.getDay() === 6;
              return (
                <th
                  key={n.night}
                  className={cn("min-w-14 px-1 py-2 text-center font-medium", weekend ? "text-foreground" : "text-muted-foreground")}
                >
                  <span className="block text-[10px] uppercase">{format(date, "EEE")}</span>
                  <span className="block text-sm">{format(date, "d")}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.roomId}>
              <td className="sticky left-0 z-10 bg-card py-1 pr-3">
                <div className="flex items-center gap-2">
                  {roomHref ? (
                    <Link href={roomHref(room.roomId)} className="truncate text-sm font-medium hover:underline">
                      {room.roomName}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium">{room.roomName}</span>
                  )}
                  {room.totalUnits === null ? (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                      Count not set
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-muted-foreground">{room.totalUnits}</span>
                  )}
                </div>
              </td>
              {room.nights.map((night) => (
                <td key={night.night} className="p-0.5">
                  <div
                    className={cn("flex h-11 flex-col items-center justify-center rounded-md", cellTone(night))}
                    title={
                      night.capacity === null
                        ? `${night.booked} booked`
                        : `${night.available} left of ${night.capacity} · ${night.b2b} agency · ${night.b2c} customer · ${night.confirmed} confirmed`
                    }
                  >
                    <span className="text-sm font-semibold leading-none">
                      {night.capacity === null ? "—" : night.available}
                    </span>
                    {night.booked > 0 ? (
                      <span className="mt-0.5 text-[10px] leading-none opacity-80">
                        {night.b2b > 0 ? `${night.b2b}A` : ""}
                        {night.b2b > 0 && night.b2c > 0 ? " · " : ""}
                        {night.b2c > 0 ? `${night.b2c}C` : ""}
                      </span>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
