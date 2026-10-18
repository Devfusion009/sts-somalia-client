import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import { getGuestBookings, getGuestDirectory } from "@/modules/hotels/guest-queries";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

function day(iso: string | null) {
  return iso ? format(new Date(`${iso}T00:00:00`), "d MMM yyyy") : "—";
}

export async function GuestView({ hotelId, guestKey, base }: { hotelId: string; guestKey: string; base: string }) {

  const key = decodeURIComponent(guestKey);
  const guest = (await getGuestDirectory(hotelId)).find((g) => g.key === key);
  if (!guest) notFound();
  const bookings = await getGuestBookings(hotelId, guest.bookingIds);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href={`${base}/guests`} label="Guests" />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold">{guest.name}</h1>
            <Badge variant="outline" className="capitalize">
              {guest.channel}
            </Badge>
            {guest.stays >= 2 ? <Badge variant="secondary">Returning</Badge> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {guest.phone ? (
              <a href={`tel:${guest.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Phone className="size-3.5" /> {guest.phone}
              </a>
            ) : null}
            {guest.email ? (
              <a href={`mailto:${guest.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-3.5" /> {guest.email}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Stays", value: guest.stays },
          { label: "Room nights", value: guest.roomNights },
          { label: "Spent", value: `${guest.currency} ${guest.totalSpent.toFixed(0)}` },
          { label: "Cancelled", value: guest.cancelled },
          { label: "No-shows", value: guest.noShows },
          { label: "Next arrival", value: day(guest.nextArrival) },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-lg font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Rooms</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link
                      href={`${base}/bookings/${b.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {b.roomName ?? "Room"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.checkIn} → {b.checkOut}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.numRooms}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.currency} {b.totalPrice.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent capitalize", STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground")}>
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
