import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { todayIso } from "@/modules/hotels/availability";
import {
  getMyManagedVenue,
  getUpcomingBlocks,
  getVenueSchedule,
  hasVenuePermission,
} from "@/modules/events/venue-manager-queries";
import { unblockVenueDates } from "@/modules/events/venue-manager-actions";
import { shortTime } from "@/modules/events/venue-desk-types";
import { BlockDatesForm } from "@/modules/events/components/venue-desk-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/ui/confirm-button";

export const metadata = { title: "Calendar" };

const CHIP: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "border border-dashed border-brand-gold/50 text-brand-gold",
};

const LEGEND = [
  { label: "Confirmed", className: "bg-primary/60" },
  { label: "Pending", className: "bg-brand-gold/70" },
  { label: "Blocked", className: "bg-foreground/25" },
];

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default async function VenueCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { venueId } = await params;
  const { month } = await searchParams;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed) notFound();

  const today = todayIso();
  const anchor = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00`) : new Date(`${today.slice(0, 7)}-01T00:00:00`);
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });

  const [{ bookings, blocks }, upcomingBlocks] = await Promise.all([
    getVenueSchedule(venueId, iso(gridStart), iso(gridEnd)),
    getUpcomingBlocks(venueId, today),
  ]);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const canBook = hasVenuePermission(managed, "bookings");
  const canBlock = hasVenuePermission(managed, "calendar");
  const base = `/manager/venues/${venueId}`;
  const prev = format(addMonths(anchor, -1), "yyyy-MM");
  const next = format(addMonths(anchor, 1), "yyyy-MM");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" render={<Link href={`?month=${prev}`} />}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-heading text-base font-semibold">{format(anchor, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" className="size-8" aria-label="Next month" render={<Link href={`?month=${next}`} />}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" render={<Link href={`${base}/calendar`} />}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="overflow-hidden py-0">
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
              const isToday = key === today;
              const bookable = canBook && !blocked && key >= today && inMonth;
              return (
                <div
                  key={key}
                  className={cn(
                    "group relative min-h-28 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    blocked && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                        isToday && "bg-primary font-semibold text-primary-foreground"
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
                      <p
                        key={b.id}
                        title={`${b.event_name || b.event_type} · ${b.contact_name ?? ""}`}
                        className={cn("truncate rounded px-1.5 py-0.5 text-[11px] font-medium", CHIP[b.status] ?? "bg-muted")}
                      >
                        {shortTime(b.start_time) ? `${shortTime(b.start_time)} ` : ""}
                        {b.event_name || b.event_type}
                      </p>
                    ))}
                    {dayBookings.length > 3 ? (
                      <p className="px-1.5 text-[11px] text-muted-foreground">+{dayBookings.length - 3}</p>
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

        {canBlock ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Block dates</CardTitle>
              </CardHeader>
              <CardContent>
                <BlockDatesForm venueId={venueId} today={today} />
              </CardContent>
            </Card>

            {upcomingBlocks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Blocked</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {upcomingBlocks.map((block) => (
                      <li key={block.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">
                            {block.date_start === block.date_end
                              ? block.date_start
                              : `${block.date_start} → ${block.date_end}`}
                          </p>
                          {block.reason ? <p className="truncate text-xs text-muted-foreground">{block.reason}</p> : null}
                        </div>
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
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
