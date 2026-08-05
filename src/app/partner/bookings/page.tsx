import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getPartnerBookings } from "@/modules/hotels/partner-queries";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingStatusControl } from "./booking-status-control";

export default async function PartnerBookingsPage() {
  const profile = await requireUser();
  const partnerId = await getMyPartnerId(profile.id);

  if (!partnerId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active hotel partner account was found for your login. Please contact support.
        </CardContent>
      </Card>
    );
  }

  const bookings = await getPartnerBookings(partnerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Bookings across all of your hotels — confirm or update their status as they come in.
        </p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.hotels?.name}</TableCell>
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
                    <BookingStatusControl bookingId={b.id} status={b.status} />
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
