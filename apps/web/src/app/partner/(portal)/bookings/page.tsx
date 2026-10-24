import { Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope, getPartnerBookings, getMyBookingManageableHotelIds } from "@/modules/hotels/partner-queries";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
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
import { dateSpan, money } from "@/lib/money";

export const metadata = { title: "Bookings" };

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
      <PageHeader
        title="Bookings"
        status={
          bookings.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {bookings.length}
            </Badge>
          ) : null
        }
      />

      <Card className="py-0">
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Ticket />
            </EmptyMedia>
            <EmptyTitle>No bookings</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {b.hotels?.name}
                      {b.channel === "b2b" ? <Badge variant="outline">Agency</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.hotel_rooms?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dateSpan(b.check_in, b.check_out)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.num_adults} adult{b.num_adults === 1 ? "" : "s"}
                    {b.num_children > 0 ? `, ${b.num_children} child${b.num_children === 1 ? "" : "ren"}` : ""}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {money(b.total_price, b.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
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
        )}
      </Card>
    </div>
  );
}
