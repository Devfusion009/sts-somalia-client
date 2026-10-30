"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Day = { date: string; booked: number; capacity: number };
const percentage = (day: Day) => day.capacity > 0 ? (day.booked / day.capacity) * 100 : 0;
const dayLabel = (date: string) => format(new Date(`${date}T00:00:00`), "d MMM");

export function HotelOccupancyChart({ daily }: { daily: Day[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const active = daily.find((day) => day.date === selected);
  const ceiling = Math.max(25, Math.ceil(Math.max(0, ...daily.map(percentage)) / 25) * 25);
  const labels = [...new Set([0, Math.floor((daily.length - 1) / 4), Math.floor((daily.length - 1) / 2), Math.floor(((daily.length - 1) * 3) / 4), daily.length - 1])];

  if (!daily.length) return <div className="grid h-56 place-items-center text-sm text-muted-foreground">No occupancy data</div>;

  return (
    <div className="px-4 pt-4 pb-5 sm:px-6">
      <div className="mb-5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-primary" />Rooms occupied</span>
        <span aria-live="polite" className="font-medium tabular-nums">
          {active ? `${dayLabel(active.date)} · ${active.booked}/${active.capacity} rooms · ${percentage(active).toFixed(1)}%` : `${dayLabel(daily[0].date)} – ${dayLabel(daily[daily.length - 1].date)}`}
        </span>
      </div>
      <div className="relative ml-9 h-48">
        {[ceiling, ceiling * .75, ceiling * .5, ceiling * .25, 0].map((tick, index) => (
          <div key={index} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${index * 25}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">{Number(tick.toFixed(1))}%</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-1" onMouseLeave={() => setSelected(null)}>
          {daily.map((day, index) => {
            const occupied = percentage(day);
            return (
              <button key={day.date} type="button"
                ref={(node) => { buttons.current[index] = node; }}
                tabIndex={index === focusedIndex ? 0 : -1}
                aria-label={`${dayLabel(day.date)}: ${day.booked} of ${day.capacity} rooms occupied, ${occupied.toFixed(1)}%`}
                onMouseEnter={() => setSelected(day.date)} onFocus={() => { setSelected(day.date); setFocusedIndex(index); }} onBlur={() => setSelected(null)}
                onClick={() => setSelected(day.date)}
                onKeyDown={(event) => {
                  const next = event.key === "ArrowRight" ? Math.min(index + 1, daily.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? daily.length - 1 : null;
                  if (next !== null) { event.preventDefault(); buttons.current[next]?.focus(); }
                }}
                className="group relative flex h-full min-w-0 flex-1 items-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={cn("w-full rounded-t-sm transition-colors", occupied === 0 ? "border-t-2 border-primary/25" : selected === day.date ? "bg-primary" : "bg-primary/65 group-hover:bg-primary")}
                  style={{ height: `${(occupied / ceiling) * 100}%` }} />
                {selected === day.date ? <span className="pointer-events-none absolute inset-0 -z-0 bg-primary/5" /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 ml-9 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        {labels.map((index) => <span key={index}>{dayLabel(daily[index].date)}</span>)}
      </div>
    </div>
  );
}
