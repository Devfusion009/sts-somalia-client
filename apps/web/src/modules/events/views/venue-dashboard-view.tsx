import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ArrowRight, CalendarPlus, Phone } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import {
  deskPayment,
  expirePastHallRequests,
  getUpcomingBlocks,
  getVenueDeskBookings,
  type DeskBooking,
  type DeskVenueRow,
} from "@/modules/events/venue-manager-queries";
import type { VenueAccess } from "@/modules/events/venue-access";
import { hallSlotLabel, shortTime } from "@/modules/events/venue-desk-types";
import { venueMoney } from "@/modules/events/components/amenities";
import { HallPaymentLabel, HallStatusBadge } from "@/modules/events/components/hall-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function blockLabel(start: string, end: string) {
  return hallSlotLabel({ start_date: start, end_date: end, start_time: null, end_time: null });
}

function BookingRow({ booking, href, showDate }: { booking: DeskBooking; href: string; showDate?: boolean }) {
  const from = shortTime(booking.start_time);
  const to = shortTime(booking.end_time);
  return (
    <li className="relative flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className="w-24 shrink-0 text-sm tabular-nums">
        {showDate ? (
          <>
            <p className="font-medium">{format(parseISO(booking.start_date), "EEE d MMM")}</p>
            <p className="text-xs text-muted-foreground">{from ? (to ? `${from}–${to}` : from) : "All day"}</p>
          </>
        ) : (
          <>
            <p className="font-medium">{from ?? "All day"}</p>
            {to ? <p className="text-xs text-muted-foreground">{to}</p> : null}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-sm font-medium after:absolute after:inset-0 hover:text-primary">
          {booking.event_name || eventTypeLabel(booking.event_type)}
          <span className="ml-1.5 font-normal text-muted-foreground">· {booking.expected_guests ?? "—"} guests</span>
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {booking.agency?.name ?? booking.contact_name ?? "Client"}
          {booking.contact_phone ? ` · ${booking.contact_phone}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <HallStatusBadge status={booking.status} />
        <HallPaymentLabel state={deskPayment(booking)} />
      </div>
    </li>
  );
}

/** One venue's operations at a glance — shared by the admin console and the venue manager portal. */
export async function VenueDashboardView({
  venue,
  base,
  access,
}: {
  venue: DeskVenueRow;
  base: string;
  access: VenueAccess;
}) {
  const today = todayIso();
  const todayDate = parseISO(today);
  const weekEnd = iso(addDays(todayDate, 6));
  const horizon = iso(addDays(todayDate, 30));
  const month = today.slice(0, 7);

  await expirePastHallRequests(venue.id);
  const [bookings, blocks] = await Promise.all([getVenueDeskBookings(venue.id), getUpcomingBlocks(venue.id, today)]);

  const bySlot = (a: DeskBooking, b: DeskBooking) =>
    a.start_date.localeCompare(b.start_date) || (a.start_time ?? "").localeCompare(b.start_time ?? "");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const todays = confirmed.filter((b) => b.start_date <= today && b.end_date >= today).sort(bySlot);
  const thisWeek = confirmed.filter((b) => b.start_date <= weekEnd && b.end_date >= today);
  const upcoming = confirmed.filter((b) => b.start_date > today && b.start_date <= horizon).sort(bySlot).slice(0, 8);
  const requests = bookings.filter((b) => b.status === "pending" || b.status === "waitlisted").sort(bySlot);
  const bookedThisMonth = bookings
    .filter((b) => (b.status === "confirmed" || b.status === "completed") && b.start_date.slice(0, 7) === month)
    .reduce((sum, b) => sum + Number(b.price), 0);
  const unpaidUpcoming = confirmed.filter((b) => b.end_date >= today && deskPayment(b) !== "paid").length;

  const canBook = access.can("bookings");

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-5">
        {[
          { label: "Events today", value: String(todays.length) },
          { label: "Next 7 days", value: String(thisWeek.length) },
          { label: "Open requests", value: String(requests.length) },
          { label: "Awaiting payment", value: String(unpaidUpcoming) },
          { label: `Booked in ${format(todayDate, "MMMM")}`, value: venueMoney(venue.currency, bookedThisMonth) },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-baseline gap-2 text-base">
                Today
                <span className="text-sm font-normal text-muted-foreground">{format(todayDate, "EEE d MMM")}</span>
              </CardTitle>
              {canBook ? (
                <Button size="sm" className="gap-1.5" render={<Link href={`${base}/bookings/new?date=${today}`} />}>
                  <CalendarPlus className="size-3.5" /> New booking
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {todays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events today.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {todays.map((b) => (
                    <BookingRow key={b.id} booking={b} href={`${base}/bookings/${b.id}`} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Next 30 days</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-primary" render={<Link href={`${base}/calendar`} />}>
                Calendar <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing confirmed.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((b) => (
                    <BookingRow key={b.id} booking={b} href={`${base}/bookings/${b.id}`} showDate />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                Requests
                <span className="rounded-full bg-brand-gold/15 px-1.5 text-xs font-semibold text-brand-gold tabular-nums">
                  {requests.length}
                </span>
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-primary"
                aria-label="All requests"
                render={<Link href={`${base}/bookings?view=requests`} />}
              >
                <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open requests.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {requests.slice(0, 6).map((b) => (
                    <li key={b.id} className="relative flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link
                          href={`${base}/bookings/${b.id}`}
                          className="block truncate text-sm font-medium after:absolute after:inset-0 hover:text-primary"
                        >
                          {b.event_name || eventTypeLabel(b.event_type)}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{hallSlotLabel(b)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.agency?.name ?? b.contact_name ?? "Client"} · {b.expected_guests ?? "—"} guests ·{" "}
                          {Number(b.price) > 0 ? venueMoney(b.currency, b.price) : "No price"}
                        </p>
                      </div>
                      <div className="relative z-10 flex shrink-0 items-center gap-1">
                        {b.status === "waitlisted" ? <HallStatusBadge status="waitlisted" /> : null}
                        {b.contact_phone ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Call ${b.contact_name ?? "client"}`}
                            render={<a href={`tel:${b.contact_phone.replace(/\s+/g, "")}`} />}
                          >
                            <Phone className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Blocked dates</CardTitle>
              <Button variant="ghost" size="icon" className="size-7 text-primary" aria-label="Calendar" render={<Link href={`${base}/calendar`} />}>
                <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {blocks.slice(0, 5).map((block) => (
                    <li key={block.id} className="py-2 text-sm first:pt-0 last:pb-0">
                      <p className="font-medium">{blockLabel(block.date_start, block.date_end)}</p>
                      {block.reason ? <p className="text-xs text-muted-foreground">{block.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
