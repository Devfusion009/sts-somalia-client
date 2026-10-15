import { format, formatDistanceToNow } from "date-fns";
import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyVenuePartnerId, getVenueBookings } from "@/modules/events/venue-partner-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VenueBookingStatusControl } from "./venue-booking-status";

export const metadata = { title: "Booking Requests" };

/**
 * The venue partner's manual-booking queue: every request for their halls,
 * newest first, same as the admin queue.
 * Confirming or declining here is the supplier's side of the workflow —
 * admin can also decide from the central Order Queue.
 */
export default async function VenueBookingsPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const bookings = await getVenueBookings(partnerId);
  const pending = bookings.filter((b) => b.status === "pending");
  const rest = bookings.filter((b) => b.status !== "pending");

  const renderBooking = (b: (typeof bookings)[number]) => {
    const venue = b.venue as unknown as { name: string } | null;
    const customer = b.customer as unknown as { full_name: string | null; email: string; phone: string | null } | null;
    return (
      <Card key={b.id} className={b.status === "pending" ? "border-brand-gold/50" : undefined}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {venue?.name ?? "Venue"}
              <span className="font-mono text-xs font-normal text-muted-foreground">{b.booking_ref}</span>
              {b.status === "pending" ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Needs decision</Badge>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">
              {b.event_name ?? b.event_type} · {format(new Date(b.start_date), "dd MMM yyyy")}
              {b.end_date && b.end_date !== b.start_date ? ` → ${format(new Date(b.end_date), "dd MMM yyyy")}` : ""}
              {b.start_time ? ` · ${b.start_time.slice(0, 5)}${b.end_time ? `–${b.end_time.slice(0, 5)}` : ""}` : ""}
              {b.expected_guests ? ` · ${b.expected_guests} guests` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {b.contact_name ?? customer?.full_name ?? customer?.email ?? "Customer"}
              {(b.contact_phone ?? customer?.phone) ? ` · ${b.contact_phone ?? customer?.phone}` : ""} · requested{" "}
              {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
            </p>
            {b.setup_requirements ? (
              <p className="mt-1 text-xs text-muted-foreground">Setup: {b.setup_requirements}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <p className="font-heading text-lg font-semibold">
              {b.currency} {Number(b.price).toFixed(2)}
            </p>
            <VenueBookingStatusControl bookingId={b.id} status={b.status} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Booking Requests</h1>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            No booking requests yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {pending.length > 0 ? <div className="space-y-3">{pending.map(renderBooking)}</div> : null}
          {rest.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Handled</p>
              {rest.map(renderBooking)}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
