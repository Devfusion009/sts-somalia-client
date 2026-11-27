"use client";

import agentUi from "@/components/portal/agent-typography.module.css";

import { AgentMoney } from "@/components/portal/agent-money";


import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  format,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Mail, MapPin, Phone, Plane, BedDouble, Landmark, PartyPopper, Flag } from "lucide-react";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CalendarBookingEvent, CalendarBookingKind } from "@/modules/admin/calendar-queries";
import type { PublicHoliday } from "@/lib/provider-runtime/holidays";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_META: Record<
  CalendarBookingKind,
  { label: string; icon: typeof BedDouble; dot: string; iconColor: string; chip: string }
> = {
  hotel: { label: "Hotel", icon: BedDouble, dot: "bg-chart-3", iconColor: "text-chart-3", chip: "bg-chart-3/15 text-chart-3" },
  flight: { label: "Flight", icon: Plane, dot: "bg-chart-4", iconColor: "text-chart-4", chip: "bg-chart-4/15 text-chart-4" },
  umrah: { label: "Umrah", icon: Landmark, dot: "bg-chart-1", iconColor: "text-chart-1", chip: "bg-chart-1/15 text-chart-1" },
  hall: { label: "Event Hall", icon: PartyPopper, dot: "bg-chart-5", iconColor: "text-chart-5", chip: "bg-chart-5/15 text-chart-5" },
};

const HOLIDAY_CHIP = "bg-primary/10 text-primary";

const FILTER_CHIP =
  "flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-9";
const FILTER_OFF = "border-border bg-card text-muted-foreground hover:text-foreground";

const STATUS_OVERRIDES = { refunded: "destructive", no_show: "neutral" } as const;

/**
 * Agent-portal counterpart to AdminEventCalendar — same booking shape and
 * grid mechanics, scoped server-side to this agency's own hotel/flight/
 * Umrah/hall bookings (getAgencyCalendarBookings), plus public holidays.
 * No cross-agency data at all: the previous version's "check availability
 * at a venue" mode (anonymized other-agency occupancy) was dropped —
 * everything on this calendar now belongs to this agency.
 */
export function EventCalendar({
  month,
  bookings,
  holidays,
}: {
  month: string;
  bookings: CalendarBookingEvent[];
  holidays: PublicHoliday[];
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<CalendarBookingKind>>(
    new Set(["hotel", "flight", "umrah", "hall"])
  );
  const [showHolidays, setShowHolidays] = useState(true);

  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const visibleBookings = useMemo(() => bookings.filter((b) => activeKinds.has(b.kind)), [bookings, activeKinds]);
  const visibleHolidays = showHolidays ? holidays : [];

  function bookingsForDay(day: Date) {
    return visibleBookings.filter((b) => isWithinInterval(day, { start: parseISO(b.startDate), end: parseISO(b.endDate) }));
  }

  function holidaysForDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return visibleHolidays.filter((h) => h.date === key);
  }

  function navigateMonth(next: Date) {
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  }

  function toggleKind(kind: CalendarBookingKind) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const selectedDayBookings = selectedDay ? bookingsForDay(selectedDay) : [];
  const selectedDayHolidays = selectedDay ? holidaysForDay(selectedDay) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => navigateMonth(subMonths(monthStart, 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 className="min-w-36 text-center font-heading text-lg font-semibold tabular-nums" aria-live="polite">
            {format(monthStart, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => navigateMonth(addMonths(monthStart, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show on calendar">
          <button
            type="button"
            aria-pressed={showHolidays}
            onClick={() => setShowHolidays((v) => !v)}
            className={cn(FILTER_CHIP, showHolidays ? cn("border-transparent", HOLIDAY_CHIP) : FILTER_OFF)}
          >
            <Flag className="size-3" aria-hidden="true" />
            Holidays
          </button>
          {(Object.keys(KIND_META) as CalendarBookingKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const active = activeKinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(kind)}
                className={cn(FILTER_CHIP, active ? cn("border-transparent", meta.chip) : FILTER_OFF)}
              >
                <span className={cn("size-2 rounded-full", meta.dot, !active && "opacity-40")} aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-b-0 border-border bg-border text-xs font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-b-lg border border-border bg-border">
          {days.map((day) => {
            const dayHolidays = holidaysForDay(day);
            const dayBookings = bookingsForDay(day);
            const inMonth = isSameMonth(day, monthStart);
            const shownHolidays = dayHolidays.slice(0, 2);
            const remainingSlots = Math.max(0, 3 - shownHolidays.length);
            const shownBookings = dayBookings.slice(0, remainingSlots);
            const overflow = dayHolidays.length + dayBookings.length - shownHolidays.length - shownBookings.length;
            const hasItems = dayHolidays.length + dayBookings.length > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                tabIndex={hasItems ? 0 : -1}
                aria-label={`${format(day, "EEEE, d MMMM yyyy")}${hasItems ? `, ${dayHolidays.length + dayBookings.length} items` : ""}`}
                onClick={() => (hasItems ? setSelectedDay(day) : undefined)}
                className={cn(
                  "flex min-h-24 flex-col gap-1 bg-background p-1.5 text-left transition-colors outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50",
                  !inMonth && "bg-muted/30 text-muted-foreground/50",
                  hasItems ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isSameDay(day, new Date()) &&
                      "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-0.5">
                  {shownHolidays.map((h) => (
                    <span
                      key={h.date + h.name}
                      aria-hidden="true"
                      className={cn("truncate rounded px-1 py-0.5 text-[10px] font-semibold", HOLIDAY_CHIP)}
                    >
                      {h.localName}
                    </span>
                  ))}
                  {shownBookings.map((b) => {
                    // Purpose first, customer second: a bare customer name
                    // repeated across a multi-day booking's whole date range
                    // (e.g. a 7-night Umrah trip) reads as unrelated same-name
                    // entries with no way to tell what was booked without
                    // opening the day.
                    const meta = KIND_META[b.kind];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`${b.kind}-${b.id}`}
                        aria-hidden="true"
                        className="flex items-center gap-1 truncate text-[10px] font-medium text-foreground"
                        title={`${meta.label} — ${b.title}${b.customerName ? ` (${b.customerName})` : ""}`}
                      >
                        <Icon className={cn("size-2.5 shrink-0", meta.iconColor)} />
                        <span className="truncate">
                          {meta.label}
                          {b.customerName ? ` · ${b.customerName}` : ""}
                        </span>
                      </span>
                    );
                  })}
                  {overflow > 0 ? (
                    <span aria-hidden="true" className="text-[10px] text-muted-foreground tabular-nums">
                      +{overflow} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className={`${agentUi.dialog} max-h-[85vh] overflow-y-auto sm:max-w-lg`}>
          <DialogHeader>
            <DialogTitle>{selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedDayHolidays.map((h) => (
              <div key={h.date + h.name} className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                <Flag className="size-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">{h.localName}</span>
                {h.localName !== h.name ? <span className="text-primary/70">({h.name})</span> : null}
              </div>
            ))}
            {selectedDayBookings.map((b) => {
              const meta = KIND_META[b.kind];
              const Icon = meta.icon;
              return (
                <div key={`${b.kind}-${b.id}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium break-words">{b.title}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {format(parseISO(b.startDate), "d MMM")}
                          {b.endDate !== b.startDate ? ` – ${format(parseISO(b.endDate), "d MMM yyyy")}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(b.status, STATUS_OVERRIDES)} className="shrink-0 capitalize">
                      {b.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                    <p className="font-medium">{b.customerName ?? "Unknown customer"}</p>
                    {b.customerPhone ? (
                      <a
                        href={`tel:${b.customerPhone}`}
                        className="flex w-fit items-center gap-1.5 rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Phone className="size-3.5" aria-hidden="true" /> {b.customerPhone}
                      </a>
                    ) : null}
                    {b.customerEmail ? (
                      <a
                        href={`mailto:${b.customerEmail}`}
                        className="flex w-fit items-center gap-1.5 rounded-sm break-all text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" /> {b.customerEmail}
                      </a>
                    ) : null}
                    {b.location ? (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" /> {b.location}
                      </p>
                    ) : null}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs sm:grid-cols-2">
                    {b.detail.map((d) => (
                      <div key={d.label} className="min-w-0">
                        <dt className="text-muted-foreground">{d.label}</dt>
                        <dd className="truncate font-medium">{d.value}</dd>
                      </div>
                    ))}
                    <div>
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="font-medium tabular-nums">{<AgentMoney value={money(b.price, b.currency)} />}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
