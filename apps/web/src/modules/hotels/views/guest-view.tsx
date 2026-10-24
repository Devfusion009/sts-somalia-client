import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import { getGuestBookings, getGuestDirectory } from "@/modules/hotels/guest-queries";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { dateSpan, money } from "@/lib/money";

const STATUS_OVERRIDES = { no_show: "neutral" } as const;

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
      <div className="flex items-start gap-3">
        <BackLink href={`${base}/guests`} label="Guests" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{guest.name}</h1>
            <Badge variant="neutral" className="capitalize">
              {guest.channel}
            </Badge>
            {guest.stays >= 2 ? <Badge variant="info">Returning</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {guest.phone ? (
              <a href={`tel:${guest.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Phone className="size-3.5" aria-hidden="true" /> {guest.phone}
              </a>
            ) : null}
            {guest.email ? (
              <a href={`mailto:${guest.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-3.5" aria-hidden="true" /> {guest.email}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <StatRail className="sm:grid-cols-3 lg:grid-cols-6">
        <StatRailItem label="Stays" value={guest.stays} />
        <StatRailItem label="Room nights" value={guest.roomNights} />
        <StatRailItem label="Spent" value={money(guest.totalSpent, guest.currency)} />
        <StatRailItem label="Cancelled" value={guest.cancelled} />
        <StatRailItem label="No-shows" value={guest.noShows} />
        <StatRailItem label="Next arrival" value={day(guest.nextArrival)} />
      </StatRail>

      <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead numeric>Rooms</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link
                      href={`${base}/bookings/${b.id}`}
                      className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {b.roomName ?? "Room"}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {dateSpan(b.checkIn, b.checkOut)}
                  </TableCell>
                  <TableCell numeric>{b.numRooms}</TableCell>
                  <TableCell numeric>
                    {money(b.totalPrice, b.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(b.status, STATUS_OVERRIDES)} className="capitalize">
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </Card>
    </div>
  );
}
