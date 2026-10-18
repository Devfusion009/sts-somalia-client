import Link from "next/link";
import { Plus } from "lucide-react";
import { todayIso } from "@/modules/hotels/availability";
import { getVenueDeskBookings } from "@/modules/events/venue-manager-queries";
import type { VenueAccess } from "@/modules/events/venue-access";
import { markHallBookingPaid } from "@/modules/events/venue-manager-actions";
import {
  HALL_STATUS_BADGE,
  PAYMENT_METHOD_LABEL,
  hallSlotLabel,
  type OfflinePaymentMethod,
} from "@/modules/events/venue-desk-types";
import { DeskPriceForm, DeskStatusControl } from "@/modules/events/components/venue-desk-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "requests", label: "Requests" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

type View = (typeof VIEWS)[number]["key"];

export async function VenueBookingsView({
  venueId,
  base,
  access,
  view: rawView,
  allowNewBooking,
}: {
  venueId: string;
  base: string;
  access: VenueAccess;
  view?: string;
  allowNewBooking: boolean;
}) {
  const view: View = VIEWS.some((v) => v.key === rawView) ? (rawView as View) : "upcoming";

  const today = todayIso();
  const all = await getVenueDeskBookings(venueId);
  const inView = (b: (typeof all)[number]) => {
    switch (view) {
      case "upcoming":
        return (b.status === "confirmed" || b.status === "pending") && b.end_date >= today;
      case "requests":
        return b.status === "pending" || b.status === "waitlisted";
      case "past":
        return b.end_date < today && !["cancelled", "refunded", "failed"].includes(b.status);
      case "cancelled":
        return ["cancelled", "refunded", "failed", "no_show"].includes(b.status);
      default:
        return true;
    }
  };
  const bookings = all.filter(inView);
  if (view === "upcoming" || view === "requests") bookings.reverse();

  const canManage = access.can("bookings");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Bookings</h1>
        {canManage && allowNewBooking ? (
          <Button className="gap-1.5" render={<Link href={`${base}/bookings/new`} />}>
            <Plus className="size-4" /> Book now
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter bookings">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`${base}/bookings?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              view === v.key
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No bookings.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const open = b.status === "pending" || b.status === "waitlisted";
                  return (
                    <TableRow key={b.id} className="align-top">
                      <TableCell>
                        <Link href={`${base}/bookings/${b.id}`} className="font-mono text-xs hover:text-primary hover:underline">
                          {b.booking_ref}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {b.channel === "b2b" ? (b.agency?.name ?? "Agency") : b.source === "offline" ? "Desk" : "Online"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{b.contact_name ?? "Client"}</p>
                        {b.contact_phone ? (
                          <a
                            href={`tel:${b.contact_phone.replace(/\s+/g, "")}`}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            {b.contact_phone}
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <p>{b.event_name || b.event_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.event_name ? `${b.event_type} · ` : ""}
                          {b.expected_guests ?? "—"} guests
                        </p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{hallSlotLabel(b)}</TableCell>
                      <TableCell>
                        {canManage && open && b.source === "online" ? (
                          <DeskPriceForm venueId={venueId} bookingId={b.id} price={Number(b.price)} currency={b.currency} />
                        ) : (
                          <span className="whitespace-nowrap">
                            {b.currency} {Number(b.price).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {b.source !== "offline" || !b.payment_method ? (
                          <span className="text-sm text-muted-foreground">Online</span>
                        ) : b.paid_at ? (
                          <span className="text-sm whitespace-nowrap">
                            {PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]}
                            <span className="ml-1.5 text-xs font-medium text-primary">Paid</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-sm whitespace-nowrap">
                            {PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]}
                            {canManage ? (
                              <form action={markHallBookingPaid}>
                                <input type="hidden" name="bookingId" value={b.id} />
                                <input type="hidden" name="venueId" value={venueId} />
                                <Button type="submit" size="xs" variant="outline">
                                  Mark paid
                                </Button>
                              </form>
                            ) : (
                              <span className="text-xs font-medium text-brand-gold">Unpaid</span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge className={cn("border-transparent capitalize", HALL_STATUS_BADGE[b.status])}>
                              {b.status.replace(/_/g, " ")}
                            </Badge>
                            <DeskStatusControl venueId={venueId} booking={b} today={today} />
                          </div>
                        ) : (
                          <Badge className={cn("border-transparent capitalize", HALL_STATUS_BADGE[b.status])}>
                            {b.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
