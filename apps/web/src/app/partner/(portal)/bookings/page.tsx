import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope, getPartnerBookings, getMyBookingManageableHotelIds } from "@/modules/hotels/partner-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingMoveActions } from "@/modules/hotels/components/booking-move-actions";
import { updateBookingStatus } from "@/modules/hotels/partner-actions";
import { todayIso } from "@/modules/hotels/availability";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

export default async function PartnerBookingsPage() {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);

  const [bookings, manageableHotelIds] = await Promise.all([
    getPartnerBookings(scope.hotelIds),
    getMyBookingManageableHotelIds(profile.id, scope),
  ]);

  const today = todayIso();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Bookings</h1>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No bookings yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.hotels?.name}
                    {b.channel === "b2b" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Agency</span> : null}
                  </TableCell>
                  <TableCell>{b.hotel_rooms?.name}</TableCell>
                  <TableCell className="text-sm">
                    {b.check_in} → {b.check_out}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.num_adults} adult{b.num_adults === 1 ? "" : "s"}
                    {b.num_children > 0 ? `, ${b.num_children} child${b.num_children === 1 ? "" : "ren"}` : ""}
                  </TableCell>
                  <TableCell className="font-medium">
                    {b.currency} {b.total_price.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent capitalize", STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground")}>
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {manageableHotelIds.has(b.hotel_id) ? (
                      <BookingMoveActions
                        bookingId={b.id}
                        status={b.status}
                        checkIn={b.check_in}
                        today={today}
                        action={updateBookingStatus}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
