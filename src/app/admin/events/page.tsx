import type { Metadata } from "next";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVenuesAdmin, getHallBookingsAdmin } from "@/modules/admin/queries";
import { VenueForm } from "./venue-form";
import { HallBookingStatusSelect, HallBookingPriceForm } from "./hall-booking-controls";
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

export default async function AdminEventsPage() {
  const [venues, bookings] = await Promise.all([getVenuesAdmin(), getHallBookingsAdmin()]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Events &amp; Halls</h1>
          <p className="text-sm text-muted-foreground">
            Manage the venue catalog and incoming hall booking requests.
          </p>
        </div>
        <VenueForm />
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Venues</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No venues yet — add your first hall.
                  </TableCell>
                </TableRow>
              ) : (
                venues.map((venue) => (
                  <TableRow key={venue.id}>
                    <TableCell>
                      <p className="font-medium">{venue.name}</p>
                      {venue.tagline ? (
                        <p className="text-xs text-muted-foreground">{venue.tagline}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{venue.city}</TableCell>
                    <TableCell>
                      {venue.capacity_seated ? `${venue.capacity_seated} seated` : "—"}
                      {venue.capacity_standing ? ` · ${venue.capacity_standing} standing` : ""}
                    </TableCell>
                    <TableCell>
                      {venue.currency} {Number(venue.base_price).toFixed(0)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {venue.price_unit.replace("per_", "/ ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-transparent capitalize",
                          VENUE_STATUS_STYLES[venue.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {venue.status.replace("_", " ")}
                      </Badge>
                      {venue.is_featured ? (
                        <Badge className="ml-1.5 border-transparent bg-brand-accent/10 text-brand-accent">
                          Featured
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <VenueForm venue={venue} />
                    </TableCell>
                  </TableRow>
                ))
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
                        {format(new Date(booking.event_date), "dd MMM yyyy")}
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
                        <HallBookingStatusSelect bookingId={booking.id} status={booking.status} />
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
