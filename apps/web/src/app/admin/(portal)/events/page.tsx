import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, ChevronRight, ImageOff, PartyPopper } from "lucide-react";
import { getVenuesAdmin, getVenueCitiesAdmin, getUpcomingHallBookingsAdmin } from "@/modules/admin/queries";
import { venueImageUrls } from "@/modules/events/images";
import { venueMoney } from "@/modules/events/components/amenities";
import { VenueFilters } from "./venue-filters";
import { VenueForm } from "./venue-form";
import { HallStatusBadge } from "@/modules/events/components/hall-badges";
import { shortTime } from "@/modules/events/venue-desk-types";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";

export const metadata: Metadata = { title: "Events & Halls" };

const linkClass =
  "rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

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
      <div className="space-y-6">
        <PageHeader title="Events & Halls" actions={<VenueForm />} />

        <StatStrip>
          <StatStripItem label="Venues" value={total} />
          <StatStripItem label="Published" value={published} />
          <StatStripItem label="Towns" value={cities.length} />
          <StatStripItem label="Awaiting decision" value={awaiting} tone={awaiting > 0 ? "warn" : undefined} />
        </StatStrip>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">Venues</h2>
          <Badge variant="neutral" className="tabular-nums">
            {filtered ? `${venues.length} of ${total}` : total}
          </Badge>
        </div>
        <VenueFilters cities={cities} />

        <Card className="overflow-hidden py-0">
          {venues.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <PartyPopper />
              </EmptyMedia>
              <EmptyTitle>{filtered ? "No venues match these filters" : "No venues"}</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Town</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead numeric>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => {
                  const cover = venueImageUrls(venue.images)[0];
                  return (
                    <TableRow key={venue.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
                          ) : (
                            <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <ImageOff className="size-4" aria-hidden="true" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <Link href={`/admin/events/${venue.id}`} className={linkClass}>
                              {venue.name}
                            </Link>
                            {venue.tagline ? (
                              <p className="max-w-xs truncate text-xs text-muted-foreground">{venue.tagline}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{venue.city}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {venue.capacity_seated || venue.capacity_standing ? (
                          <>
                            {venue.capacity_seated ? `${venue.capacity_seated} seated` : ""}
                            {venue.capacity_seated && venue.capacity_standing ? (
                              <span className="text-muted-foreground"> · </span>
                            ) : null}
                            {venue.capacity_standing ? `${venue.capacity_standing} standing` : ""}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap">
                        {Number(venue.base_price) > 0 ? (
                          <>
                            <span className="font-medium">{venueMoney(venue.currency, venue.base_price)}</span>
                            <span className="ml-1 text-xs text-muted-foreground">
                              {venue.price_unit.replace("per_", "/ ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">On request</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={statusBadgeVariant(venue.status)} className="capitalize">
                            {venue.status.replace(/_/g, " ")}
                          </Badge>
                          {venue.is_featured ? <Badge variant="info">Featured</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell numeric>
                        <div className="flex justify-end gap-1">
                          <VenueForm venue={venue} />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Manage ${venue.name}`}
                            title="Manage"
                            render={<Link href={`/admin/events/${venue.id}`} />}
                          >
                            <ChevronRight />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold">Upcoming events</h2>
        <Card className="overflow-hidden py-0">
          {bookings.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>No upcoming events</EmptyTitle>
            </Empty>
          ) : (
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
                {bookings.map((booking) => (
                  <TableRow key={booking.id} className="relative">
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/events/${booking.venue_id}/bookings/${booking.id}`}
                        className={`${linkClass} tabular-nums after:absolute after:inset-0`}
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
                      <p className="text-xs text-muted-foreground tabular-nums">
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
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
