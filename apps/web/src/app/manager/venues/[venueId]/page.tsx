import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { ArrowRight, CalendarPlus, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { todayIso } from "@/modules/hotels/availability";
import {
  getMyManagedVenue,
  getUpcomingBlocks,
  getVenueDeskBookings,
  hasVenuePermission,
  type DeskBooking,
} from "@/modules/events/venue-manager-queries";
import { HALL_STATUS_BADGE, hallSlotLabel, shortTime } from "@/modules/events/venue-desk-types";
import { DeskDecision } from "@/modules/events/components/venue-desk-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const VENUE_STATUS_BADGE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function AgendaRow({ booking }: { booking: DeskBooking }) {
  const from = shortTime(booking.start_time);
  const to = shortTime(booking.end_time);
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className="w-20 shrink-0 text-sm">
        <p className="font-medium tabular-nums">{from ?? "All day"}</p>
        {to ? <p className="text-xs text-muted-foreground tabular-nums">{to}</p> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {booking.event_name || booking.event_type}
          <span className="ml-1.5 font-normal text-muted-foreground">· {booking.expected_guests ?? "—"} guests</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {booking.contact_name ?? "Client"}
          {booking.contact_phone ? ` · ${booking.contact_phone}` : ""}
        </p>
      </div>
      <Badge className={cn("shrink-0 border-transparent capitalize", HALL_STATUS_BADGE[booking.status])}>
        {booking.status.replace(/_/g, " ")}
      </Badge>
    </li>
  );
}

export default async function VenueManagerDashboard({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed) notFound();

  const today = todayIso();
  const todayDate = new Date(`${today}T00:00:00`);
  const weekEnd = iso(addDays(todayDate, 6));
  const horizon = iso(addDays(todayDate, 30));
  const monthStart = today.slice(0, 8) + "01";

  const [bookings, blocks] = await Promise.all([getVenueDeskBookings(venueId), getUpcomingBlocks(venueId, today)]);

  const live = bookings.filter((b) => b.status === "confirmed" || b.status === "pending");
  const todays = live
    .filter((b) => b.start_date <= today && b.end_date >= today)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const thisWeek = live.filter((b) => b.start_date <= weekEnd && b.end_date >= today);
  const upcoming = live
    .filter((b) => b.start_date > today && b.start_date <= horizon)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 8);
  const requests = bookings
    .filter((b) => b.status === "pending" || b.status === "waitlisted")
    .filter((b) => b.source === "online")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const bookedThisMonth = bookings
    .filter((b) => (b.status === "confirmed" || b.status === "completed") && b.start_date >= monthStart && b.start_date.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, b) => sum + Number(b.price), 0);

  const canBook = hasVenuePermission(managed, "bookings");
  const base = `/manager/venues/${venueId}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">{managed.venue.name}</h1>
          <Badge
            className={cn(
              "border-transparent capitalize",
              VENUE_STATUS_BADGE[managed.venue.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            {managed.venue.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {managed.venue.city}, {managed.venue.country_code}
          {managed.venue.capacity_standing || managed.venue.capacity_seated
            ? ` · up to ${managed.venue.capacity_standing ?? managed.venue.capacity_seated} guests`
            : ""}
        </p>
      </div>

      {canBook ? (
        <Link
          href={`${base}/bookings/new`}
          className="flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-foreground/15">
            <CalendarPlus className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold">Record offline booking</span>
          <ArrowRight className="size-4.5 shrink-0" />
        </Link>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "Events today", value: String(todays.length) },
          { label: "Next 7 days", value: String(thisWeek.length) },
          { label: "Open requests", value: String(requests.length) },
          { label: "Booked this month", value: money(managed.venue.currency, bookedThisMonth) },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Today
                <span className="text-sm font-normal text-muted-foreground">{format(todayDate, "EEE d MMM")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events today.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {todays.map((b) => (
                    <AgendaRow key={b.id} booking={b} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Upcoming</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-primary" render={<Link href={`${base}/calendar`} />}>
                Calendar <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing booked in the next 30 days.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {b.event_name || b.event_type}
                          <span className="ml-1.5 font-normal text-muted-foreground">· {b.contact_name ?? "Client"}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{hallSlotLabel(b)}</p>
                      </div>
                      <Badge className={cn("shrink-0 border-transparent capitalize", HALL_STATUS_BADGE[b.status])}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </li>
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
                <Badge variant="secondary">{requests.length}</Badge>
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
                    <li key={b.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{b.event_type}</p>
                          <p className="truncate text-xs text-muted-foreground">{hallSlotLabel(b)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {b.agency?.name ?? b.contact_name ?? "Client"} · {b.expected_guests ?? "—"} guests
                          </p>
                        </div>
                        {b.contact_phone ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            aria-label={`Call ${b.contact_name ?? "client"}`}
                            render={<a href={`tel:${b.contact_phone.replace(/\s+/g, "")}`} />}
                          >
                            <Phone className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      {b.status === "waitlisted" ? (
                        <Badge className={cn("border-transparent", HALL_STATUS_BADGE.waitlisted)}>Waitlisted</Badge>
                      ) : null}
                      {canBook ? <DeskDecision venueId={venueId} bookingId={b.id} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {blocks.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Blocked dates</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {blocks.slice(0, 5).map((block) => (
                    <li key={block.id} className="py-2 text-sm first:pt-0 last:pb-0">
                      <p className="font-medium">
                        {block.date_start === block.date_end ? block.date_start : `${block.date_start} → ${block.date_end}`}
                      </p>
                      {block.reason ? <p className="text-xs text-muted-foreground">{block.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
