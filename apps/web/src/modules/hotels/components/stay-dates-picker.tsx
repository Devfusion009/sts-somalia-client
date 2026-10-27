"use client";

import { createContext, useContext, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange, DayButton } from "react-day-picker";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getHotelPriceCalendar, type CalendarNight } from "@/modules/hotels/calendar-actions";

const MAX_NIGHTS = 60;

/** Local calendar date → "YYYY-MM-DD" (no UTC shift). */
function toIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** 98 → "98", 1250 → "1.3k": fits under a day number. */
function compactPrice(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(value));
}

type PriceContextValue = { prices: Record<string, CalendarNight>; cheapest: number | null; todayIso: string };

const PriceContext = createContext<PriceContextValue>({ prices: {}, cheapest: null, todayIso: "" });

/** Day cell with the night's lowest price, or "Full" when no room is left. */
function PriceDayButton({ children, ...props }: React.ComponentProps<typeof DayButton>) {
  const { prices, cheapest, todayIso } = useContext(PriceContext);
  const iso = toIso(props.day.date);
  const info = iso >= todayIso ? prices[iso] : undefined;
  return (
    <CalendarDayButton {...props}>
      {children}
      {info ? (
        info.available && info.minRate !== null ? (
          <span
            className={cn(
              "text-[10px] leading-none tabular-nums",
              cheapest !== null && info.minRate <= cheapest * 1.1 && "font-semibold text-primary opacity-100"
            )}
          >
            {compactPrice(info.minRate)}
          </span>
        ) : (
          <span className="text-[10px] leading-none text-destructive">Full</span>
        )
      ) : null}
    </CalendarDayButton>
  );
}

/**
 * Check-in → check-out field with a two-month calendar showing each night's
 * lowest available price (hotel_price_calendar). Submits `checkIn` and
 * `checkOut` with its form.
 */
export function StayDatesPicker({
  hotelId,
  currency,
  defaultCheckIn,
  defaultCheckOut,
  className,
  id,
}: {
  hotelId: string;
  currency: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  className?: string;
  id?: string;
}) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = fromIso(defaultCheckIn);
    return from ? { from, to: fromIso(defaultCheckOut) } : undefined;
  });
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => range?.from ?? new Date());
  const [prices, setPrices] = useState<Record<string, CalendarNight>>({});
  const loaded = useRef(new Set<string>());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  async function load(first: Date) {
    const months = [new Date(first.getFullYear(), first.getMonth(), 1), new Date(first.getFullYear(), first.getMonth() + 1, 1)];
    const pending = months.filter((m) => !loaded.current.has(monthKey(m)));
    if (pending.length === 0) return;
    pending.forEach((m) => loaded.current.add(monthKey(m)));
    const results = await Promise.all(
      pending.map((m) => {
        const start = m < today ? today : m;
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        return start < end ? getHotelPriceCalendar(hotelId, toIso(start), toIso(end)).catch(() => []) : Promise.resolve([]);
      })
    );
    setPrices((current) => {
      const next = { ...current };
      for (const night of results.flat()) next[night.night] = night;
      return next;
    });
  }

  const shown = Object.values(prices).filter((p) => p.available && p.minRate !== null);
  const cheapest = shown.length > 0 ? Math.min(...shown.map((p) => p.minRate as number)) : null;

  const nights =
    range?.from && range.to ? Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) : 0;
  const label =
    range?.from && range.to
      ? `${shortDate.format(range.from)} → ${shortDate.format(range.to)}`
      : range?.from
        ? `${shortDate.format(range.from)} → Check-out`
        : "Check-in → Check-out";

  return (
    <>
      <input type="hidden" name="checkIn" value={range?.from ? toIso(range.from) : ""} />
      <input type="hidden" name="checkOut" value={range?.from && range.to ? toIso(range.to) : ""} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void load(month);
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              id={id}
              className={cn(
                "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                !range?.from && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {nights > 0 ? (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {nights} night{nights === 1 ? "" : "s"}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] gap-3 p-3">
          <PriceContext.Provider value={{ prices, cheapest, todayIso: toIso(today) }}>
          <Calendar
            mode="range"
            numberOfMonths={2}
            month={month}
            onMonthChange={(next) => {
              setMonth(next);
              void load(next);
            }}
            startMonth={new Date(today.getFullYear(), today.getMonth(), 1)}
            selected={range}
            onSelect={(next) => {
              setRange(next);
              if (next?.from && next.to && next.to > next.from) setOpen(false);
            }}
            min={1}
            max={MAX_NIGHTS}
            disabled={{ before: today }}
            className="[--cell-size:--spacing(10)]"
            components={{ DayButton: PriceDayButton }}
          />
          </PriceContext.Provider>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">{currency} · per night</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRange(undefined)} disabled={!range?.from}>
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
