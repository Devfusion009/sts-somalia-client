import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
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
import { getVenuesAdmin, getVenueCitiesAdmin, getHallBookingsAdmin } from "@/modules/admin/queries";
import { venueImageUrls } from "@/modules/events/images";
import { VenueFilters } from "./venue-filters";
import { VenueForm } from "./venue-form";
import { HallBookingPriceForm } from "./hall-booking-controls";
import { HallMoveActions } from "@/modules/events/components/hall-move-actions";
import { updateHallBookingStatus } from "@/modules/admin/actions";
import { todayIso } from "@/modules/hotels/availability";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Events & Halls" };

const VENUE_STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-chart-3/10 text-chart-3",
  cancelled: "bg-destructive/10 text-destructive",
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const [venues, { cities, total, published }, bookings] = await Promise.all([
    getVenuesAdmin(sp),
    getVenueCitiesAdmin(),
    getHallBookingsAdmin(),
  ]);
  const awaiting = bookings.filter((b) => b.status === "pending").length;
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
                              {venue.currency} {Number(venue.base_price).toFixed(0)}
                            </span>{" "}
                            <span className="text-xs text-muted-foreground">
                              {venue.price_unit.replace("per_", "/ ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
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
        <h2 className="font-heading text-lg font-semibold">Hall bookings</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No hall bookings yet.
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs">{booking.booking_ref}</TableCell>
                    <TableCell>
                      <p className="font-medium">{booking.venue?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{booking.venue?.city}</p>
                    </TableCell>
                    <TableCell>
                      <p>{booking.customer?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{booking.customer?.email}</p>
                    </TableCell>
                    <TableCell>
                      <p className="capitalize">{booking.event_type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(booking.start_date), "dd MMM yyyy")}
                        {booking.end_date !== booking.start_date
                          ? ` – ${format(new Date(booking.end_date), "dd MMM yyyy")}`
                          : ""}
                        {booking.start_time ? ` · ${booking.start_time.slice(0, 5)}` : ""}
                        {booking.end_time ? `–${booking.end_time.slice(0, 5)}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>{booking.expected_guests ?? "—"}</TableCell>
                    <TableCell>
                      <HallBookingPriceForm
                        bookingId={booking.id}
                        price={Number(booking.price)}
                        currency={booking.currency}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            BOOKING_STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {booking.status.replace("_", " ")}
                        </Badge>
                        <HallMoveActions booking={booking} today={todayIso()} isAdmin action={updateHallBookingStatus} />
                      </div>
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
