"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseTime(value: string | undefined) {
  const [h, m] = (value || "12:00").split(":").map((n) => Number(n) || 0);
  // Snap to a 5-minute grid so the minute dial (which only offers :00/:05/.../:55
  // positions) always has a matching selected tick, even for an odd stored value.
  const snappedMinute = Math.round(m / 5) * 5;
  return { hour24: h, minute: snappedMinute >= 60 ? 0 : snappedMinute };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toHHMM(hour24: number, minute: number) {
  return `${pad(hour24)}:${pad(minute)}`;
}

const HOUR_DIAL = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_DIAL = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** Angle 0 = 12 o'clock, increasing clockwise; matches a real clock face. */
function dialPosition(index: number, radiusPct: number) {
  const angleDeg = index * 30 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    left: 50 + radiusPct * Math.cos(angleRad),
    top: 50 + radiusPct * Math.sin(angleRad),
    handRotateDeg: angleDeg + 90,
  };
}

/**
 * Analog-clock time picker — replaces the browser's native <input
 * type="time">, whose per-segment editing UI (see the reference screenshot:
 * a tiny blue-highlighted "02" segment you have to arrow-key through) reads
 * fiddly and looks different on every OS/browser. This mirrors the familiar
 * tap-a-number dial from Android/Material's time picker: pick the hour, it
 * auto-advances to minutes, done. Still submits the same "HH:mm" 24-hour
 * string via a hidden input, so the server schema and every downstream
 * reader (review summary, reminders) are untouched.
 */
export function AnalogTimeField({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const initial = parseTime(defaultValue);
  const [hour24, setHour24] = useState(initial.hour24);
  const [minute, setMinute] = useState(initial.minute);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"hour" | "minute">("hour");

  const period: "AM" | "PM" = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  function setPeriod(next: "AM" | "PM") {
    if (next === period) return;
    setHour24((h) => (next === "AM" ? h - 12 : h + 12));
  }

  function pickHour(h12: number) {
    setHour24(period === "AM" ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12);
    setView("minute");
  }

  const dialItems = view === "hour" ? HOUR_DIAL : MINUTE_DIAL;
  const activeValue = view === "hour" ? hour12 : minute;
  const activeIndex = dialItems.indexOf(activeValue);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setView("hour");
      }}
    >
      <input type="hidden" name={name} value={toHHMM(hour24, minute)} required={required} />
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
        {pad(hour12)}:{pad(minute)} {period}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-baseline gap-1 font-heading text-2xl font-bold">
            <button type="button" onClick={() => setView("hour")} className={cn("rounded px-1", view === "hour" ? "text-primary" : "text-foreground")}>
              {pad(hour12)}
            </button>
            <span>:</span>
            <button type="button" onClick={() => setView("minute")} className={cn("rounded px-1", view === "minute" ? "text-primary" : "text-foreground")}>
              {pad(minute)}
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setPeriod("AM")}
              className={cn("rounded px-2 py-0.5 text-xs font-semibold", period === "AM" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setPeriod("PM")}
              className={cn("rounded px-2 py-0.5 text-xs font-semibold", period === "PM" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              PM
            </button>
          </div>
        </div>

        <div className="relative mx-auto size-48 rounded-full bg-muted">
          <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          {activeIndex >= 0 ? (
            <div
              className="absolute bottom-1/2 left-1/2 h-[38%] w-0.5 origin-bottom bg-primary"
              style={{ transform: `translateX(-50%) rotate(${dialPosition(activeIndex, 0).handRotateDeg}deg)` }}
            />
          ) : null}
          {dialItems.map((value, i) => {
            const { left, top } = dialPosition(i, 38);
            const active = value === activeValue;
            return (
              <button
                key={value}
                type="button"
                onClick={() => (view === "hour" ? pickHour(value) : setMinute(value))}
                className={cn(
                  "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {pad(value)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Done
        </button>
      </PopoverContent>
    </Popover>
  );
}
