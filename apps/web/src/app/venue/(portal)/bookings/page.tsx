import { formatDistanceToNow } from "date-fns";
import { Inbox, Phone } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { requireUser } from "@/lib/auth/session";
import { getMyVenuePartnerId, getVenueBookings } from "@/modules/events/venue-partner-queries";
import { hallSlotLabel } from "@/modules/events/venue-desk-types";
import { venueMoney } from "@/modules/events/components/amenities";
import { HallStatusBadge } from "@/modules/events/components/hall-badges";
import { DeskPriceForm } from "@/modules/events/components/venue-desk-controls";
import { Card, CardContent } from "@/components/ui/card";
import { todayIso } from "@/modules/hotels/availability";
import { VenueBookingStatusControl } from "./venue-booking-status";

export const metadata = { title: "Booking Requests" };

type PartnerBooking = Awaited<ReturnType<typeof getVenueBookings>>[number];

/**
 * The venue partner's manual-booking queue: requests needing a price or a
 * decision first (soonest event first), then everything already handled.
 * Admin can also decide from the central Order Queue.
 */
export default async function VenueBookingsPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const bookings = await getVenueBookings(partnerId);
  const today = todayIso();
  const isOpen = (b: PartnerBooking) => b.status === "pending" || b.status === "waitlisted";
  const open = bookings.filter(isOpen).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const rest = bookings.filter((b) => !isOpen(b));

  const renderBooking = (b: PartnerBooking) => {
    const venue = b.venue as unknown as { name: string } | null;
    const customer = b.customer as unknown as { full_name: string | null; email: string; phone: string | null } | null;
    const orderStatus = (b.order_items as unknown as Array<{ order: { status: string } | null }>)?.[0]?.order?.status;
    const unpaid = !orderStatus || orderStatus === "pending_payment" || orderStatus === "held";
    const phone = b.contact_phone ?? customer?.phone ?? null;
    const canQuote = isOpen(b) && b.source === "online" && unpaid;
    return (
      <Card key={b.id} className={isOpen(b) ? "border-brand-gold/50" : undefined}>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {b.event_name || eventTypeLabel(b.event_type)}
              <HallStatusBadge status={b.status} />
            </p>
            <p className="text-sm text-muted-foreground">
              {venue?.name ?? "Venue"} · {hallSlotLabel(b)}
              {b.expected_guests ? ` · ${b.expected_guests} guests` : ""}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{b.contact_name ?? customer?.full_name ?? customer?.email ?? "Client"}</span>
              {phone ? (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="size-3" /> {phone}
                </a>
              ) : null}
              <span className="font-mono">{b.booking_ref}</span>
              <span>· {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
            </p>
            {b.setup_requirements ? (
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">{b.setup_requirements}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            {canQuote ? (
              <DeskPriceForm venueId={b.venue_id} bookingId={b.id} price={Number(b.price)} currency={b.currency} />
            ) : (
              <p className="font-heading text-lg font-semibold tabular-nums">
                {Number(b.price) > 0 ? venueMoney(b.currency, b.price) : "Not set"}
              </p>
            )}
            <VenueBookingStatusControl booking={b} today={today} paid={!unpaid} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Booking Requests</h1>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            No booking requests yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {open.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Needs decision · {open.length}</h2>
              {open.map(renderBooking)}
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Handled</h2>
              {rest.map(renderBooking)}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
