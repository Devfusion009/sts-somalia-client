"use client";

import { useState } from "react";
import { Minus, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  OCCUPANCY_LIMITS,
  formatOccupancy,
  occupancySummary,
  occupancyTotals,
  type RoomOccupancy,
} from "@/modules/hotels/booking-options";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          aria-label={`Remove ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          aria-label={`Add ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Per-room adults/children editor: the body of the picker, also used inline on the booking page. */
export function OccupancyEditor({
  rooms,
  onChange,
  maxGuestsPerRoom,
  maxRooms = OCCUPANCY_LIMITS.rooms,
}: {
  rooms: RoomOccupancy[];
  onChange: (rooms: RoomOccupancy[]) => void;
  /** A room type's max occupancy; adults + children per room never exceed it. */
  maxGuestsPerRoom?: number;
  maxRooms?: number;
}) {
  const cap = maxGuestsPerRoom ?? OCCUPANCY_LIMITS.adults + OCCUPANCY_LIMITS.children;
  const update = (index: number, patch: Partial<RoomOccupancy>) =>
    onChange(rooms.map((room, i) => (i === index ? { ...room, ...patch } : room)));

  return (
    <div className="space-y-4">
      {rooms.map((room, index) => (
        <div key={index} className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Room {index + 1}</p>
            {rooms.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove room ${index + 1}`}
                onClick={() => onChange(rooms.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <Stepper
            label="Adults"
            value={room.adults}
            min={1}
            max={Math.min(OCCUPANCY_LIMITS.adults, cap - room.children)}
            onChange={(adults) => update(index, { adults })}
          />
          <Stepper
            label="Children"
            value={room.children}
            min={0}
            max={Math.min(OCCUPANCY_LIMITS.children, cap - room.adults)}
            onChange={(children) => update(index, { children })}
          />
        </div>
      ))}
      {rooms.length < maxRooms ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onChange([...rooms, { adults: Math.min(2, cap), children: 0 }])}
        >
          <Plus data-icon="inline-start" aria-hidden="true" /> Add another room
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "2 adults · 1 room" field that opens a per-room adults/children editor.
 * Uncontrolled, it submits `occ` ("2-1,2-0", one entry per room) and
 * `guests` (total) with its form; controlled (value + onChange, name null)
 * it only reports changes.
 */
export function OccupancyPicker({
  defaultValue,
  value,
  onChange,
  name = "occ",
  className,
  id,
}: {
  defaultValue?: RoomOccupancy[];
  value?: RoomOccupancy[];
  onChange?: (rooms: RoomOccupancy[]) => void;
  name?: string | null;
  className?: string;
  id?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? [{ adults: 2, children: 0 }]);
  const rooms = value ?? own;
  const setRooms = (next: RoomOccupancy[]) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const totals = occupancyTotals(rooms);

  return (
    <>
      {name ? <input type="hidden" name={name} value={formatOccupancy(rooms)} /> : null}
      {name ? <input type="hidden" name="guests" value={totals.guests} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              id={id}
              className={cn(
                "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                className
              )}
            />
          }
        >
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{occupancySummary(rooms)}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-4 p-4">
          <OccupancyEditor rooms={rooms} onChange={setRooms} />
          <Button type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </PopoverContent>
      </Popover>
    </>
  );
}
