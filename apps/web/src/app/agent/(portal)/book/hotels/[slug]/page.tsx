import { AgentMoney } from "@/components/portal/agent-money";
import { notFound, redirect } from "next/navigation";
import { BedDouble, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { getAgencyMarkupRule } from "@/modules/agencies/markup";
import { getHotelBySlug, getRoomAvailability } from "@/modules/hotels/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money, shortDate } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeskBookingForm } from "./desk-booking-form";

/** Search params are free text — only a real yyyy-MM-dd gets formatted. */
function dayLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? shortDate(value) : "—";
}

export default async function AgentHotelRoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const [{ slug }, { checkIn = "", checkOut = "", guests = "" }] = await Promise.all([
    params,
    searchParams,
  ]);

  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book?service=hotels");

  const hotel = await getHotelBySlug(slug);
  if (!hotel) notFound();

  const rooms = hotel.hotel_rooms.filter((room) => room.status === "published");
  const [availability, markup] = await Promise.all([
    getRoomAvailability(
      rooms.map((room) => room.id),
      checkIn,
      checkOut
    ),
    getAgencyMarkupRule(supabase, membership.agency.id, "hotel"),
  ]);

  const bookingMode = hotel.booking_mode === "instant" ? "instant" : "manual";
  const available =
    Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);

  const nights =
    checkIn && checkOut && checkOut > checkIn
      ? Math.round(
          (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) /
            86_400_000
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/agent/book/hotels", label: "Hotels" }}
        title={hotel.name}
        status={
          <Badge variant={bookingMode === "instant" ? "success" : "neutral"}>
            {bookingMode === "instant" ? "Instant" : "On request"}
          </Badge>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>{[hotel.city, hotel.country_code].filter(Boolean).join(", ")}</span>
            {hotel.star_rating ? (
              <span className="flex items-center gap-1" aria-label={`${hotel.star_rating} stars`}>
                · <Star className="size-3.5 fill-brand-gold text-brand-gold" aria-hidden="true" />
                {hotel.star_rating}
              </span>
            ) : null}
          </span>
        }
      />

      {checkIn || checkOut ? (
        <StatRail className="sm:grid-cols-3">
          <StatRailItem label="Check-in" value={dayLabel(checkIn)} />
          <StatRailItem label="Check-out" value={dayLabel(checkOut)} />
          <StatRailItem label="Nights" value={nights || "—"} />
        </StatRail>
      ) : null}

      <Card className="overflow-hidden py-0">
        {rooms.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <BedDouble />
            </EmptyMedia>
            <EmptyTitle>No published rooms</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead numeric>Sleeps</TableHead>
                <TableHead numeric>Per night</TableHead>
                <TableHead numeric>Left</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => {
                const left = availability.get(room.id);
                return (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell numeric className="text-sm">
                      {room.max_occupancy}
                    </TableCell>
                    <TableCell numeric className="text-sm font-medium">
                      {room.base_price > 0 ? (
                        <AgentMoney value={money(Number(room.base_price), room.currency)} />
                      ) : (
                        <span className="font-normal text-muted-foreground">On request</span>
                      )}
                    </TableCell>
                    <TableCell numeric className="text-sm">
                      {left === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : left === 0 ? (
                        <Badge variant="neutral">Sold out</Badge>
                      ) : (
                        left
                      )}
                    </TableCell>
                    <TableCell numeric>
                      <DeskBookingForm
                        hotelId={hotel.id}
                        room={{
                          id: room.id,
                          name: room.name,
                          base_price: Number(room.base_price),
                          currency: room.currency,
                          max_occupancy: room.max_occupancy,
                        }}
                        bookingMode={bookingMode}
                        agencyCustomerId={customers[0].id}
                        customerCount={customers.length}
                        markup={markup}
                        available={available}
                        roomsLeft={left}
                        defaults={{ checkIn, checkOut, guests }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
