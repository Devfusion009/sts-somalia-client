"use client";

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
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plane,
  BedDouble,
  Landmark,
  PartyPopper,
  Flag,
  CalendarClock,
  Bell,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CalendarBookingEvent, CalendarBookingKind } from "@/modules/admin/calendar-queries";
import type { PublicHoliday } from "@/lib/provider-runtime/holidays";
import type { AdminCalendarEvent } from "@/modules/admin/calendar-events";
import { deleteAdminCalendarEvent } from "@/modules/admin/calendar-event-actions";
import { AdminEventForm } from "./admin-event-form";
import { ConfirmButton } from "@/components/ui/confirm-button";

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

const HOLIDAY_CHIP = "bg-primary text-primary-foreground";

// The one KIND_META color unused by real bookings (chart-2), reserved for
// admin's own scheduled items — visually distinct from every booking kind
// and from the holiday chip at a glance.
const TASK_META = { label: "My schedule", icon: CalendarClock, dot: "bg-chart-2", chip: "bg-chart-2/15 text-chart-2" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

/**
 * Platform-wide booking calendar for admin — every hotel/flight/Umrah/hall
 * booking with a trip date, aggregated across ALL agencies and customers
 * (unlike the agent portal's Event Calendar, which is RLS-scoped to one
 * agency and anonymizes anything outside it), plus public holidays fetched
 * live from src/lib/provider-runtime/holidays.ts. No such restriction
 * applies to bookings here: is_admin() already grants full read, so every
 * booking shows full customer contact info directly.
 */
export function AdminEventCalendar({
  month,
  events,
  holidays,
  adminEvents,
}: {
  month: string;
  events: CalendarBookingEvent[];
  holidays: PublicHoliday[];
  adminEvents: AdminCalendarEvent[];
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<CalendarBookingKind>>(
    new Set(["hotel", "flight", "umrah", "hall"])
  );
  const [showHolidays, setShowHolidays] = useState(true);
  const [showTasks, setShowTasks] = useState(true);

  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const visibleEvents = useMemo(() => events.filter((e) => activeKinds.has(e.kind)), [events, activeKinds]);
  const visibleHolidays = showHolidays ? holidays : [];
  const visibleAdminEvents = showTasks ? adminEvents : [];

  function eventsForDay(day: Date) {
    return visibleEvents.filter((e) => isWithinInterval(day, { start: parseISO(e.startDate), end: parseISO(e.endDate) }));
  }

  function holidaysForDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return visibleHolidays.filter((h) => h.date === key);
  }

  // Admin-authored events carry a real start/end timestamp (not date-only
  // like bookings), so a meeting on 9 Aug at 2pm shows only on the 9th, not
  // every day between month start and end — match on the local calendar
  // date of start_at (and end_at, for the rare item crossing midnight).
  function adminEventsForDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return visibleAdminEvents
      .filter((e) => format(parseISO(e.start_at), "yyyy-MM-dd") === key || format(parseISO(e.end_at), "yyyy-MM-dd") === key)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
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

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];
  const selectedDayHolidays = selectedDay ? holidaysForDay(selectedDay) : [];
  const selectedDayAdminEvents = selectedDay ? adminEventsForDay(selectedDay) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(subMonths(monthStart, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-heading text-lg font-semibold">{format(monthStart, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(addMonths(monthStart, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminEventForm prefillDate={format(new Date(), "yyyy-MM-dd")} />
          <button
            type="button"
            onClick={() => setShowTasks((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              showTasks ? cn("border-transparent", TASK_META.chip) : "border-border text-muted-foreground opacity-50"
            )}
          >
            <CalendarClock className="size-3" />
            {TASK_META.label}
          </button>
          <button
            type="button"
            onClick={() => setShowHolidays((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              showHolidays ? cn("border-transparent", HOLIDAY_CHIP) : "border-border text-muted-foreground opacity-50"
            )}
          >
            <Flag className="size-3" />
            Holidays
          </button>
          {(Object.keys(KIND_META) as CalendarBookingKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const active = activeKinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active ? cn("border-transparent", meta.chip) : "border-border text-muted-foreground opacity-50"
                )}
              >
                <span className={cn("size-2 rounded-full", meta.dot)} />
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
            const dayEvents = eventsForDay(day);
            const dayAdminEvents = adminEventsForDay(day);
            const inMonth = isSameMonth(day, monthStart);
            const shownHolidays = dayHolidays.slice(0, 2);
            const remainingAfterHolidays = Math.max(0, 3 - shownHolidays.length);
            const shownAdminEvents = dayAdminEvents.slice(0, remainingAfterHolidays);
            const remainingSlots = Math.max(0, remainingAfterHolidays - shownAdminEvents.length);
            const shownEvents = dayEvents.slice(0, remainingSlots);
            const overflow =
              dayHolidays.length +
              dayAdminEvents.length +
              dayEvents.length -
              shownHolidays.length -
              shownAdminEvents.length -
              shownEvents.length;
            const hasItems = dayHolidays.length + dayEvents.length + dayAdminEvents.length > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => (hasItems ? setSelectedDay(day) : undefined)}
                className={cn(
                  "flex min-h-24 flex-col gap-1 bg-background p-1.5 text-left transition-colors",
                  !inMonth && "bg-muted/30 text-muted-foreground/50",
                  hasItems && "cursor-pointer hover:bg-accent"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
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
                      className={cn("truncate rounded px-1 py-0.5 text-[10px] font-semibold", HOLIDAY_CHIP)}
                    >
                      {h.localName}
                    </span>
                  ))}
                  {shownAdminEvents.map((e) => (
                    <span
                      key={e.id}
                      className="flex items-center gap-1 truncate text-[10px] font-medium text-foreground"
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", TASK_META.dot)} />
                      <span className="truncate">
                        {format(parseISO(e.start_at), "HH:mm")} {e.title}
                      </span>
                    </span>
                  ))}
                  {shownEvents.map((e) => {
                    // Purpose first, customer second: a bare customer name
                    // repeated across a multi-day booking's whole date range
                    // (e.g. a 7-night Umrah trip) reads as unrelated same-name
                    // entries with no way to tell what was booked without
                    // opening the day. The kind icon + label makes the type
                    // legible at a glance and ties the repeated cells together
                    // as one booking spanning the week.
                    const meta = KIND_META[e.kind];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`${e.kind}-${e.id}`}
                        className="flex items-center gap-1 truncate text-[10px] font-medium text-foreground"
                        title={`${meta.label} — ${e.title}${e.customerName ? ` (${e.customerName})` : ""}`}
                      >
                        <Icon className={cn("size-2.5 shrink-0", meta.iconColor)} />
                        <span className="truncate">
                          {meta.label}
                          {e.customerName ? ` · ${e.customerName}` : ""}
                        </span>
                      </span>
                    );
                  })}
                  {overflow > 0 ? <span className="text-[10px] text-muted-foreground">+{overflow} more</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <DialogTitle>{selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : ""}</DialogTitle>
              {selectedDay ? <AdminEventForm prefillDate={format(selectedDay, "yyyy-MM-dd")} /> : null}
            </div>
            <DialogDescription>
              {selectedDayEvents.length} booking{selectedDayEvents.length === 1 ? "" : "s"}
              {selectedDayAdminEvents.length > 0
                ? ` · ${selectedDayAdminEvents.length} on your schedule`
                : ""}
              {selectedDayHolidays.length > 0
                ? ` · ${selectedDayHolidays.length} holiday${selectedDayHolidays.length === 1 ? "" : "s"}`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedDayHolidays.map((h) => (
              <div key={h.date + h.name} className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                <Flag className="size-4 shrink-0" />
                <span className="font-medium">{h.localName}</span>
                {h.localName !== h.name ? <span className="text-primary/70">({h.name})</span> : null}
              </div>
            ))}
            {selectedDayAdminEvents.map((e) => (
              <div key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TASK_META.chip)}>
                      <CalendarClock className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(e.start_at), "HH:mm")} – {format(parseISO(e.end_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AdminEventForm event={e} />
                    <form action={deleteAdminCalendarEvent}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton
                        title="Delete this event?"
                        description={e.title}
                        aria-label="Delete event"
                        size="icon"
                        variant="outline"
                        className="size-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
                {e.location ? (
                  <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" /> {e.location}
                  </p>
                ) : null}
                {e.description ? <p className="mt-1.5 text-sm text-muted-foreground">{e.description}</p> : null}
                {e.reminder_minutes_before != null ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bell className="size-3.5" /> Notify {e.reminder_minutes_before} minute
                    {e.reminder_minutes_before === 1 ? "" : "s"} before
                  </p>
                ) : null}
              </div>
            ))}
            {selectedDayEvents.map((e) => {
              const meta = KIND_META[e.kind];
              const Icon = meta.icon;
              return (
                <div key={`${e.kind}-${e.id}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(e.startDate), "d MMM")}
                          {e.endDate !== e.startDate ? ` – ${format(parseISO(e.endDate), "d MMM yyyy")}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("border-transparent capitalize", STATUS_STYLES[e.status] ?? "bg-muted text-muted-foreground")}>
                      {e.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                    <p className="font-medium">{e.customerName ?? "Unknown customer"}</p>
                    {e.customerPhone ? (
                      <a href={`tel:${e.customerPhone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                        <Phone className="size-3.5" /> {e.customerPhone}
                      </a>
                    ) : null}
                    {e.customerEmail ? (
                      <a href={`mailto:${e.customerEmail}`} className="flex items-center gap-1.5 text-primary hover:underline">
                        <Mail className="size-3.5" /> {e.customerEmail}
                      </a>
                    ) : null}
                    {e.location ? (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5" /> {e.location}
                      </p>
                    ) : null}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 border-t border-border pt-3 text-xs">
                    {e.detail.map((d) => (
                      <div key={d.label} className="min-w-0">
                        <dt className="text-muted-foreground">{d.label}</dt>
                        <dd className="truncate font-medium">{d.value}</dd>
                      </div>
                    ))}
                    <div>
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="font-medium">
                        {e.currency} {e.price.toFixed(2)}
                      </dd>
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
