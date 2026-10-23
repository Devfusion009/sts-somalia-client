import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Users, ImageOff, Settings2 } from "lucide-react";
import { getVenuesAdmin, getVenueCitiesAdmin, getUpcomingHallBookingsAdmin } from "@/modules/admin/queries";
import { venueImageUrls } from "@/modules/events/images";
import { venueMoney } from "@/modules/events/components/amenities";
import { VenueFilters } from "./venue-filters";
import { VenueForm } from "./venue-form";
import { HallStatusBadge } from "@/modules/events/components/hall-badges";
import { shortTime } from "@/modules/events/venue-desk-types";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Events & Halls" };

const VENUE_STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const [venues, { cities, total, published }, { bookings, awaiting }] = await Promise.all([
    getVenuesAdmin(sp),
    getVenueCitiesAdmin(),
    getUpcomingHallBookingsAdmin(todayIso()),
  ]);
  const filtered = Boolean(sp.q || sp.status || sp.city);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold">Events &amp; Halls</h1>
        <VenueForm />
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "Venues", value: total },
          { label: "Published", value: published },
          { label: "Towns", value: cities.length },
          { label: "Awaiting decision", value: awaiting },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 font-heading text-2xl font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold">Venues</h2>
          {filtered ? (
            <span className="text-sm text-muted-foreground">
              {venues.length} of {total}
            </span>
          ) : null}
        </div>
        <VenueFilters cities={cities} />

        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Town</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {filtered ? "No venues match." : "No venues yet."}
                  </TableCell>
                </TableRow>
              ) : (
                venues.map((venue) => {
                  const cover = venueImageUrls(venue.images)[0];
                  return (
                    <TableRow key={venue.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
                          ) : (
                            <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <ImageOff className="size-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/admin/events/${venue.id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {venue.name}
                            </Link>
                            {venue.tagline ? (
                              <p className="max-w-xs truncate text-xs text-muted-foreground">{venue.tagline}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-muted-foreground" />
                          {venue.city}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {venue.capacity_seated || venue.capacity_standing ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="size-3.5 text-muted-foreground" />
                            {venue.capacity_seated ? `${venue.capacity_seated} seated` : ""}
                            {venue.capacity_seated && venue.capacity_standing ? " · " : ""}
                            {venue.capacity_standing ? `${venue.capacity_standing} standing` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {Number(venue.base_price) > 0 ? (
                          <>
                            <span className="font-semibold">
                              {venueMoney(venue.currency, venue.base_price)}
                            </span>{" "}
                            <span className="text-xs text-muted-foreground">
                              {venue.price_unit.replace("per_", "/ ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">On request</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            className={cn(
                              "border-transparent capitalize",
                              VENUE_STATUS_STYLES[venue.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {venue.status.replace("_", " ")}
                          </Badge>
                          {venue.is_featured ? (
                            <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Featured</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 whitespace-nowrap"
                            render={<Link href={`/admin/events/${venue.id}`} />}
                          >
                            <Settings2 className="size-3.5" /> Manage
                          </Button>
                          <VenueForm venue={venue} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Upcoming events</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No upcoming events.
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow key={booking.id} className="relative">
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/events/${booking.venue_id}/bookings/${booking.id}`}
                        className="font-medium after:absolute after:inset-0 hover:text-primary"
                      >
                        {format(parseISO(booking.start_date), "EEE d MMM yyyy")}
                      </Link>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {booking.end_date !== booking.start_date ? `to ${format(parseISO(booking.end_date), "d MMM")} · ` : ""}
                        {shortTime(booking.start_time)
                          ? `${shortTime(booking.start_time)}${booking.end_time ? `–${shortTime(booking.end_time)}` : ""}`
                          : "All day"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{booking.event_name || eventTypeLabel(booking.event_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.expected_guests ?? "—"} guests · <span className="font-mono">{booking.booking_ref}</span>
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{booking.venue?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{booking.venue?.city}</p>
                    </TableCell>
                    <TableCell>{booking.agency?.name ?? booking.contact_name ?? "Client"}</TableCell>
                    <TableCell>
                      <HallStatusBadge status={booking.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
