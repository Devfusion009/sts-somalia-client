import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getPartnerBookings } from "@/modules/hotels/partner-queries";
import { hotelGuestNames } from "@/modules/orders/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusControl } from "@/app/partner/(portal)/bookings/booking-status-control";

export const metadata = { title: "Bookings" };

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
};

export default async function ManagerBookingsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const bookings = await getPartnerBookings([hotelId]);
  const canManage = hasPermission(managed, "bookings");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Bookings</h1>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No bookings yet.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {hotelGuestNames(b.guest_details)[0] ?? "Guest"}
                  </TableCell>
                  <TableCell>
                    {b.hotel_rooms?.name}
                    {b.channel === "b2b" ? <span className="ml-1.5 text-xs text-muted-foreground">Agency</span> : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.check_in} → {b.check_out}
                  </TableCell>
                  <TableCell>{b.num_rooms}</TableCell>
                  <TableCell>
                    {b.currency} {Number(b.total_price).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <BookingStatusControl bookingId={b.id} status={b.status} />
                    ) : (
                      <Badge className={`border-transparent capitalize ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    )}
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
