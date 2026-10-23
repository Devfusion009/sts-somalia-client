import Link from "next/link";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import { getUpcomingBlocks, getVenueSchedule } from "@/modules/events/venue-manager-queries";
import { unblockVenueDates } from "@/modules/events/venue-manager-actions";
import type { VenueAccess } from "@/modules/events/venue-access";
import { hallSlotLabel, shortTime } from "@/modules/events/venue-desk-types";
import { BlockDatesForm } from "@/modules/events/components/venue-desk-controls";
import { HallStatusBadge } from "@/modules/events/components/hall-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cn } from "@/lib/utils";

const CHIP: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary hover:bg-primary/20",
  completed: "bg-muted text-muted-foreground hover:bg-muted/70",
  pending: "bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25",
  waitlisted: "border border-dashed border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10",
};

const LEGEND = [
  { label: "Confirmed", className: "bg-primary/60" },
  { label: "Request", className: "bg-brand-gold/70" },
  { label: "Waitlisted", className: "border border-dashed border-brand-gold" },
  { label: "Blocked", className: "bg-foreground/25" },
];

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function rangeLabel(start: string, end: string) {
  return hallSlotLabel({ start_date: start, end_date: end, start_time: null, end_time: null });
}

/** Month grid of one venue's bookings and blocked dates — shared by admin and the venue manager portal. */
export async function VenueCalendarView({
  venueId,
  base,
  access,
  month,
}: {
  venueId: string;
  base: string;
  access: VenueAccess;
  month?: string;
}) {
  const today = todayIso();
  const anchor = parseISO(`${month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7)}-01`);
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });

  const [{ bookings, blocks }, upcomingBlocks] = await Promise.all([
    getVenueSchedule(venueId, iso(gridStart), iso(gridEnd)),
    getUpcomingBlocks(venueId, today),
  ]);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const canBook = access.can("bookings");
  const canBlock = access.can("calendar");
  const prev = format(addMonths(anchor, -1), "yyyy-MM");
  const next = format(addMonths(anchor, 1), "yyyy-MM");
  const monthKey = format(anchor, "yyyy-MM");
  const monthBookings = bookings.filter((b) => b.start_date.slice(0, 7) <= monthKey && b.end_date.slice(0, 7) >= monthKey);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">{format(anchor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" render={<Link href={`${base}/calendar?month=${prev}`} />}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" render={<Link href={`${base}/calendar`} />}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="size-8" aria-label="Next month" render={<Link href={`${base}/calendar?month=${next}`} />}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <Card className="hidden overflow-hidden py-0 md:block">
          <div className="grid grid-cols-7 border-b border-border bg-secondary/40 text-center text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = iso(d);
              const dayBookings = bookings.filter((b) => b.start_date <= key && b.end_date >= key);
              const blocked = blocks.find((bl) => bl.date_start <= key && bl.date_end >= key);
              const inMonth = isSameMonth(d, anchor);
              const bookable = canBook && !blocked && key >= today && inMonth;
              return (
                <div
                  key={key}
                  className={cn(
                    "group relative min-h-28 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    key < today && inMonth && "bg-muted/15",
                    blocked && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                        key === today && "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {bookable ? (
                      <Link
                        href={`${base}/bookings/new?date=${key}`}
                        aria-label={`Book ${format(d, "d MMMM")}`}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {blocked ? (
                      <p className="truncate rounded bg-foreground/10 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70">
                        {blocked.reason || "Blocked"}
                      </p>
                    ) : null}
                    {dayBookings.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`${base}/bookings/${b.id}`}
                        title={`${b.event_name || eventTypeLabel(b.event_type)} · ${b.contact_name ?? ""}`}
                        className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors", CHIP[b.status] ?? "bg-muted")}
                      >
                        {shortTime(b.start_time) ? `${shortTime(b.start_time)} ` : ""}
                        {b.event_name || eventTypeLabel(b.event_type)}
                      </Link>
                    ))}
                    {dayBookings.length > 3 ? (
                      <Link
                        href={`${base}/bookings?view=all`}
                        className="block px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        +{dayBookings.length - 3} more
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", item.className)} /> {item.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Phones get the month as a list; seven columns can't hold an event name at that width. */}
        <Card className="md:hidden">
          <CardContent>
            {monthBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings this month.</p>
            ) : (
              <ul className="divide-y divide-border">
                {monthBookings.map((b) => (
                  <li key={b.id} className="relative flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`${base}/bookings/${b.id}`} className="block truncate text-sm font-medium after:absolute after:inset-0">
                        {b.event_name || eventTypeLabel(b.event_type)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{hallSlotLabel(b)}</p>
                    </div>
                    <HallStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {canBlock ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Block dates</CardTitle>
            </CardHeader>
            <CardContent>
              <BlockDatesForm venueId={venueId} today={today} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingBlocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{rangeLabel(block.date_start, block.date_end)}</p>
                      {block.reason ? <p className="truncate text-xs text-muted-foreground">{block.reason}</p> : null}
                    </div>
                    {canBlock ? (
                      <form action={unblockVenueDates}>
                        <input type="hidden" name="venueId" value={venueId} />
                        <input type="hidden" name="blockId" value={block.id} />
                        <ConfirmButton
                          title="Unblock these dates?"
                          confirmLabel="Unblock"
                          icon="x"
                          destructive={false}
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Unblock"
                        >
                          <X className="size-3.5" />
                        </ConfirmButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
