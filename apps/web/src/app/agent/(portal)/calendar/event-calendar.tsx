"use client";

import { useState } from "react";
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
import { AlertTriangle, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AgencyHallBooking } from "@/modules/agencies/queries";

type OccupiedRange = { start_date: string; end_date: string; status: string };
type VenueOption = { id: string; name: string };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month grid built with date-fns, not a scheduling-library dependency — the
 * project had no event/occupancy calendar component before this, only a
 * date-picker (ui/calendar.tsx). "Conflict" is computed client-side by
 * grouping same-venue bookings/occupied-ranges per day, not a stored
 * concept — the booking-time check in modules/events/actions.ts already
 * blocks new overlapping bookings, so this is mainly a defensive/visual
 * signal for edge cases (admin overrides, race conditions).
 */
export function EventCalendar({
  month,
  venues,
  selectedVenueId,
  ownBookings,
  otherOccupied,
}: {
  month: string;
  venues: VenueOption[];
  selectedVenueId: string | null;
  ownBookings: AgencyHallBooking[];
  otherOccupied: OccupiedRange[];
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function ownForDay(day: Date) {
    return ownBookings.filter((b) =>
      isWithinInterval(day, { start: parseISO(b.start_date), end: parseISO(b.end_date) })
    );
  }
  function occupiedForDay(day: Date) {
    if (!selectedVenueId) return [];
    return otherOccupied.filter((r) =>
      isWithinInterval(day, { start: parseISO(r.start_date), end: parseISO(r.end_date) })
    );
  }
  function conflictCountForDay(day: Date) {
    const own = ownForDay(day);
    if (selectedVenueId) {
      const occ = occupiedForDay(day);
      const total = own.length + occ.length;
      return total >= 2 ? total : 0;
    }
    const byVenue = new Map<string, number>();
    for (const b of own) byVenue.set(b.venue_id, (byVenue.get(b.venue_id) ?? 0) + 1);
    return Math.max(0, ...byVenue.values());
  }

  function navigate(next: { month?: string; venue?: string | null }) {
    const params = new URLSearchParams();
    params.set("month", next.month ?? month);
    const venue = next.venue === undefined ? selectedVenueId : next.venue;
    if (venue) params.set("venue", venue);
    router.push(`/calendar?${params.toString()}`);
  }

  const selectedDayOwn = selectedDay ? ownForDay(selectedDay) : [];
  const selectedDayOccupied = selectedDay ? occupiedForDay(selectedDay) : [];
  const selectedDayConflicts = selectedDay ? conflictCountForDay(selectedDay) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate({ month: format(subMonths(monthStart, 1), "yyyy-MM") })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-heading text-lg font-semibold">
            {format(monthStart, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate({ month: format(addMonths(monthStart, 1), "yyyy-MM") })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <select
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={selectedVenueId ?? ""}
          onChange={(e) => navigate({ venue: e.target.value || null })}
        >
          <option value="">My bookings — all venues</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              Check availability: {v.name}
            </option>
          ))}
        </select>
      </div>

      {selectedVenueId ? (
        <p className="text-xs text-muted-foreground">
          Showing your agency&apos;s bookings at this venue, plus dates already taken by other agencies (shown as
          &ldquo;Occupied&rdquo; — those details are private to that agency).
        </p>
      ) : null}

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
            const own = ownForDay(day);
            const occupied = occupiedForDay(day);
            const conflicts = conflictCountForDay(day);
            const inMonth = isSameMonth(day, monthStart);
            const chips = [
              ...own.map((b) => ({ id: b.id, label: b.event_name || b.event_type.replace(/_/g, " "), own: true })),
              ...occupied.map((_, i) => ({ id: `occ-${i}`, label: "Occupied", own: false })),
            ];
            const hasItems = chips.length > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => (hasItems ? setSelectedDay(day) : undefined)}
                className={cn(
                  "flex min-h-24 flex-col gap-1 bg-background p-1.5 text-left transition-colors",
                  !inMonth && "bg-muted/30 text-muted-foreground/50",
                  hasItems && "cursor-pointer hover:bg-accent",
                  conflicts > 0 && "ring-2 ring-inset ring-destructive"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isSameDay(day, new Date()) &&
                        "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {conflicts > 0 ? <AlertTriangle className="size-3.5 text-destructive" /> : null}
                </div>
                <div className="flex flex-col gap-0.5">
                  {chips.slice(0, 2).map((chip) => (
                    <span
                      key={chip.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        chip.own ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {chip.label}
                    </span>
                  ))}
                  {chips.length > 2 ? (
                    <span className="text-[10px] text-muted-foreground">+{chips.length - 2} more</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : ""}</DialogTitle>
            <DialogDescription>
              {selectedDayOwn.length + selectedDayOccupied.length} event
              {selectedDayOwn.length + selectedDayOccupied.length === 1 ? "" : "s"} on this date.
            </DialogDescription>
          </DialogHeader>
          {selectedDayConflicts > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {selectedDayConflicts} bookings overlap the same venue on this date — review before confirming either.
            </div>
          ) : null}
          <div className="space-y-3">
            {selectedDayOwn.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{b.event_name || b.event_type.replace(/_/g, " ")}</p>
                  <Badge variant="outline" className="capitalize">
                    {b.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{b.venue?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(b.start_date), "d MMM")} – {format(parseISO(b.end_date), "d MMM yyyy")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5 text-muted-foreground" /> {b.expected_guests ?? "—"} guests
                  </span>
                  <span className="text-muted-foreground">{b.customer?.full_name ?? b.customer?.email}</span>
                </div>
              </div>
            ))}
            {selectedDayOccupied.map((r, i) => (
              <div key={i} className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Booked by another agency — details are private. {format(parseISO(r.start_date), "d MMM")} –{" "}
                {format(parseISO(r.end_date), "d MMM yyyy")}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
