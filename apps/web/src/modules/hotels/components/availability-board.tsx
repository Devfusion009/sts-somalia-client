import Link from "next/link";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RoomAvailability, RoomNight } from "@/modules/hotels/availability";

type Tone = "open" | "limited" | "full" | "unset";

function toneOf(night: RoomNight): Tone {
  if (night.capacity === null || night.available === null) return "unset";
  if (night.available <= 0) return "full";
  if (night.available <= Math.max(1, Math.ceil(night.capacity * 0.2))) return "limited";
  return "open";
}

const CELL: Record<Tone, string> = {
  open: "bg-primary/[0.06] text-foreground hover:bg-primary/[0.12]",
  limited: "bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25",
  full: "bg-destructive/10 text-destructive hover:bg-destructive/15",
  unset: "bg-muted/50 text-muted-foreground hover:bg-muted",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "Open", className: "bg-primary/25" },
  { label: "Limited", className: "bg-brand-gold/50" },
  { label: "Sold out", className: "bg-destructive/40" },
  { label: "Count not set", className: "bg-muted-foreground/25" },
];

function parse(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Rooms × nights grid for the admin, partner and manager consoles. Each
 * cell shows rooms left, a booked bar split agency / customer, and opens
 * the room's own calendar. The RPC behind it decides who may see a hotel.
 */
export function AvailabilityBoard({
  rooms,
  from,
  days,
  today,
  roomHref,
  rangeHref,
}: {
  rooms: RoomAvailability[];
  from: string;
  days: number;
  today: string;
  roomHref?: (roomId: string) => string;
  /** Link to the same page showing the range that starts on `from`. */
  rangeHref: (from: string) => string;
}) {
  const start = parse(from);
  const end = addDays(start, days - 1);
  const prev = format(addDays(start, -days), "yyyy-MM-dd");
  const next = format(addDays(start, days), "yyyy-MM-dd");

  const all = rooms.flatMap((r) => r.nights);
  const tonight = rooms.map((r) => r.nights.find((n) => n.night === today)).filter((n): n is RoomNight => !!n);
  const tonightCapacity = tonight.reduce((s, n) => s + (n.capacity ?? 0), 0);
  const tonightBooked = tonight.reduce((s, n) => s + n.booked, 0);
  const soldOut = all.filter((n) => toneOf(n) === "full").length;
  const pending = all.reduce((s, n) => s + n.pending, 0);
  const rangeCapacity = all.reduce((s, n) => s + (n.capacity ?? 0), 0);
  const rangeBooked = all.reduce((s, n) => s + (n.capacity === null ? 0 : n.booked), 0);

  const stats = [
    {
      label: "Tonight",
      value: tonight.length ? `${tonightBooked} / ${tonightCapacity}` : "—",
      meta: tonight.length ? `${pct(tonightBooked, tonightCapacity)}%` : null,
    },
    { label: "Occupancy", value: `${pct(rangeBooked, rangeCapacity)}%`, meta: null },
    { label: "Sold-out nights", value: String(soldOut), meta: null },
    { label: "Pending", value: String(pending), meta: null },
  ];

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-heading text-sm font-semibold tabular-nums">
          {format(start, "d MMM")} – {format(end, "d MMM yyyy")}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous nights"
            render={<Link href={rangeHref(prev)} scroll={false} />}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={from === today}
            render={<Link href={rangeHref(today)} scroll={false} />}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next nights"
            render={<Link href={rangeHref(next)} scroll={false} />}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No rooms yet.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-secondary/40 px-4 py-2.5">
                <dt className="text-[11px] font-medium text-muted-foreground uppercase">{s.label}</dt>
                <dd className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-lg font-semibold tabular-nums">{s.value}</span>
                  {s.meta ? <span className="text-xs text-muted-foreground">{s.meta}</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-44 border-r border-b border-border bg-card px-4 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase">
                    Room
                  </th>
                  {rooms[0].nights.map((n, i) => {
                    const date = parse(n.night);
                    const weekend = date.getDay() === 5 || date.getDay() === 6;
                    const isToday = n.night === today;
                    const monthStart = i === 0 || date.getDate() === 1;
                    return (
                      <th
                        key={n.night}
                        className={cn(
                          "min-w-16 border-b border-border px-0.5 pt-1.5 pb-2 text-center font-medium",
                          weekend && "bg-secondary/40",
                          isToday && "rounded-t-lg bg-primary/10",
                          monthStart && i > 0 && "border-l"
                        )}
                      >
                        <span className="block h-3.5 text-[10px] font-semibold text-primary uppercase">
                          {isToday ? "Today" : monthStart ? format(date, "MMM") : ""}
                        </span>
                        <span className={cn("block text-[10px] uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                          {format(date, "EEE")}
                        </span>
                        <span
                          className={cn(
                            "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm tabular-nums",
                            isToday ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"
                          )}
                        >
                          {format(date, "d")}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const href = roomHref?.(room.roomId);
                  const counted = room.nights.filter((n) => n.capacity !== null);
                  const occupancy = pct(
                    counted.reduce((s, n) => s + n.booked, 0),
                    counted.reduce((s, n) => s + (n.capacity ?? 0), 0)
                  );
                  return (
                    <tr key={room.roomId} className="group/row">
                      <td className="sticky left-0 z-10 border-r border-b border-border bg-card px-4 py-2 group-last/row:border-b-0">
                        {href ? (
                          <Link href={href} className="block truncate text-sm font-medium hover:text-primary">
                            {room.roomName}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm font-medium">{room.roomName}</span>
                        )}
                        {room.totalUnits === null ? (
                          <Badge variant="outline" className="mt-1 text-[10px] text-muted-foreground">
                            Count not set
                          </Badge>
                        ) : (
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                            {room.totalUnits} rooms
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${occupancy}%` }} />
                            </span>
                            {occupancy}%
                          </span>
                        )}
                      </td>
                      {room.nights.map((night, i) => {
                        const date = parse(night.night);
                        const weekend = date.getDay() === 5 || date.getDay() === 6;
                        const tone = toneOf(night);
                        const cap = night.capacity ?? 0;
                        const agencyW = cap ? Math.min(100, (night.b2b / cap) * 100) : 0;
                        const customerW = cap ? Math.min(100 - agencyW, (night.b2c / cap) * 100) : 0;
                        const cellClass = cn(
                          "relative flex h-12 flex-col items-center justify-center overflow-hidden rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          CELL[tone],
                          night.night === today && "ring-2 ring-primary"
                        );
                        const body = (
                          <>
                            <span className="text-sm leading-none font-semibold tabular-nums">
                              {tone === "unset" ? "—" : tone === "full" ? "0" : night.available}
                            </span>
                            {night.capacity !== null ? (
                              <span className="mt-1 text-[10px] leading-none opacity-70 tabular-nums">/ {night.capacity}</span>
                            ) : null}
                            {night.booked > 0 && cap > 0 ? (
                              <span className="absolute inset-x-1 bottom-1 flex h-1 overflow-hidden rounded-full bg-foreground/10">
                                <span className="h-full bg-primary" style={{ width: `${agencyW}%` }} />
                                <span className="h-full bg-sky-500" style={{ width: `${customerW}%` }} />
                              </span>
                            ) : null}
                          </>
                        );
                        return (
                          <td
                            key={night.night}
                            className={cn(
                              "border-b border-border p-0.5 group-last/row:border-b-0",
                              weekend && "bg-secondary/40",
                              night.night === today && "bg-primary/10",
                              (i === 0 || date.getDate() === 1) && i > 0 && "border-l"
                            )}
                          >
                            <Tooltip>
                              <TooltipTrigger
                                render={href ? <Link href={href} className={cellClass} /> : <div tabIndex={0} className={cellClass} />}
                              >
                                {body}
                              </TooltipTrigger>
                              <TooltipContent className="flex-col items-start gap-0.5 px-3 py-2">
                                <span className="font-semibold">
                                  {room.roomName} · {format(date, "EEE d MMM")}
                                </span>
                                <span className="opacity-80 tabular-nums">
                                  {night.capacity === null
                                    ? `${night.booked} booked`
                                    : `${night.available ?? 0} left of ${night.capacity}`}
                                </span>
                                {night.booked > 0 ? (
                                  <span className="opacity-80 tabular-nums">
                                    Agency {night.b2b} · Customer {night.b2c}
                                    {night.pending > 0 ? ` · Pending ${night.pending}` : ""}
                                  </span>
                                ) : null}
                                {night.priceOverride !== null ? (
                                  <span className="opacity-80 tabular-nums">Rate {night.priceOverride}</span>
                                ) : null}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", item.className)} />
                {item.label}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-4 rounded-full bg-primary" /> Agency
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-4 rounded-full bg-sky-500" /> Customer
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
