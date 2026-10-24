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
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Hourglass, Plus, X, type LucideIcon } from "lucide-react";
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
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cn } from "@/lib/utils";

const GOLD_TEXT = "text-[color-mix(in_oklch,var(--brand-gold),black_45%)] dark:text-brand-gold";

/** Each slot state carries a shape or glyph as well as a color, so the grid reads without color. */
const CHIP: Record<string, { label: string; className: string; icon?: LucideIcon }> = {
  confirmed: { label: "Confirmed", className: "border-l-2 border-primary bg-primary/10 text-primary hover:bg-primary/20" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground hover:bg-muted/70", icon: Check },
  pending: { label: "Request", className: `bg-brand-gold/15 hover:bg-brand-gold/25 ${GOLD_TEXT}`, icon: Clock },
  waitlisted: {
    label: "Waitlisted",
    className: `border border-dashed border-brand-gold/60 hover:bg-brand-gold/10 ${GOLD_TEXT}`,
    icon: Hourglass,
  },
};

const LEGEND: { label: string; swatch: string; icon?: LucideIcon }[] = [
  { label: "Confirmed", swatch: "border-l-2 border-primary bg-primary/15" },
  { label: "Request", swatch: `bg-brand-gold/20 ${GOLD_TEXT}`, icon: Clock },
  { label: "Waitlisted", swatch: `border border-dashed border-brand-gold ${GOLD_TEXT}`, icon: Hourglass },
  { label: "Completed", swatch: "bg-muted text-muted-foreground", icon: Check },
  { label: "Blocked", swatch: "bg-foreground/10 text-foreground/70", icon: Ban },
];

function eventName(b: { event_name: string | null; event_type: string }) {
  return b.event_name || eventTypeLabel(b.event_type);
}

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
  const monthStart = iso(startOfMonth(anchor));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold tabular-nums">{format(anchor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" aria-label="Previous month" render={<Link href={`${base}/calendar?month=${prev}`} />}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" render={<Link href={`${base}/calendar`} />}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" render={<Link href={`${base}/calendar?month=${next}`} />}>
              <ChevronRight />
            </Button>
            {canBook ? (
              <Button
                size="icon"
                className="ml-1.5"
                aria-label="New booking"
                title="New booking"
                render={<Link href={`${base}/bookings/new`} />}
              >
                <Plus />
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="hidden overflow-hidden py-0 md:block">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium text-muted-foreground">
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
              const isToday = key === today;
              return (
                <div
                  key={key}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "group relative min-h-28 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    key < today && inMonth && "bg-muted/15",
                    isToday && "bg-primary/5 shadow-[inset_0_2px_0_var(--color-primary)]",
                    blocked && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                          isToday && "bg-primary font-semibold text-primary-foreground",
                          key < today && inMonth && "text-muted-foreground"
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      {isToday ? <span className="text-[11px] font-semibold text-primary">Today</span> : null}
                    </span>
                    {bookable ? (
                      <Link
                        href={`${base}/bookings/new?date=${key}`}
                        aria-label={`Book ${format(d, "d MMMM")}`}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {blocked ? (
                      <p
                        title={blocked.reason ? `Blocked · ${blocked.reason}` : "Blocked"}
                        className="flex items-center gap-1 truncate rounded bg-foreground/10 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70"
                      >
                        <Ban className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{blocked.reason || "Blocked"}</span>
                      </p>
                    ) : null}
                    {dayBookings.slice(0, 3).map((b) => {
                      const chip = CHIP[b.status];
                      const Icon = chip?.icon;
                      const label = `${eventName(b)} · ${chip?.label ?? b.status.replace(/_/g, " ")}${b.contact_name ? ` · ${b.contact_name}` : ""}`;
                      return (
                        <Link
                          key={b.id}
                          href={`${base}/bookings/${b.id}`}
                          title={label}
                          aria-label={label}
                          className={cn(
                            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            chip?.className ?? "bg-muted"
                          )}
                        >
                          {Icon ? <Icon className="size-3 shrink-0" aria-hidden="true" /> : null}
                          <span className="truncate">
                            {shortTime(b.start_time) ? <span className="tabular-nums">{shortTime(b.start_time)} </span> : null}
                            {eventName(b)}
                          </span>
                        </Link>
                      );
                    })}
                    {dayBookings.length > 3 ? (
                      <Link
                        href={`${base}/bookings?view=all`}
                        className="block rounded px-1.5 text-[11px] text-muted-foreground tabular-nums outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        +{dayBookings.length - 3} more
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className={cn("grid h-4 w-5 place-items-center rounded-sm", item.swatch)} aria-hidden="true">
                  {item.icon ? <item.icon className="size-3" /> : null}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </Card>

        {/* Phones get the month as a list; seven columns can't hold an event name at that width. */}
        {monthBookings.length === 0 ? (
          <Card className="md:hidden">
            <Empty>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>No bookings in {format(anchor, "MMMM")}</EmptyTitle>
            </Empty>
          </Card>
        ) : (
          <Card className="py-0 md:hidden">
            <ul className="divide-y divide-border">
              {monthBookings.map((b) => {
                const onToday = b.start_date <= today && b.end_date >= today;
                const shownKey = b.start_date < monthStart ? monthStart : b.start_date;
                const shown = parseISO(shownKey);
                const tileToday = shownKey === today;
                return (
                  <li
                    key={b.id}
                    className="relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        "grid w-11 shrink-0 place-items-center rounded-md py-1 text-center tabular-nums",
                        tileToday ? "bg-primary text-primary-foreground" : "bg-secondary/60"
                      )}
                      aria-hidden="true"
                    >
                      <span className={cn("text-[10px] font-medium", tileToday ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {format(shown, "EEE")}
                      </span>
                      <span className="text-base leading-tight font-semibold">{format(shown, "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`${base}/bookings/${b.id}`}
                        className="block truncate rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {eventName(b)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {onToday ? "Today · " : ""}
                        {hallSlotLabel(b)}
                      </p>
                    </div>
                    <HallStatusBadge status={b.status} className="shrink-0" />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
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
            <CardTitle className="text-base">Blocked dates</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked dates</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingBlocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium tabular-nums">{rangeLabel(block.date_start, block.date_end)}</p>
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
                          size="icon-sm"
                          aria-label={`Unblock ${rangeLabel(block.date_start, block.date_end)}`}
                        >
                          <X />
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
