import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { getAgencyMarkupRule } from "@/modules/agencies/markup";
import { getHotelBySlug, getRoomAvailability } from "@/modules/hotels/queries";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeskBookingForm } from "./desk-booking-form";

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
  if (customers.length === 0) redirect("/agent/book");

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

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book/hotels"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Hotels
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">{hotel.name}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{[hotel.city, hotel.country_code].filter(Boolean).join(", ")}</span>
          {hotel.star_rating ? (
            <span className="flex items-center gap-1">
              · <Star className="size-3.5 fill-brand-gold text-brand-gold" />
              {hotel.star_rating}
            </span>
          ) : null}
          <span>· {bookingMode === "instant" ? "Instant" : "On request"}</span>
        </p>
      </div>

      {rooms.length === 0 ? (
        <Card className="py-16 text-center text-sm text-muted-foreground">
          No published rooms.
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Sleeps</TableHead>
                  <TableHead className="text-right">Per night</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => {
                  const left = availability.get(room.id);
                  return (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell className="text-right text-sm">{room.max_occupancy}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {room.base_price > 0
                          ? `${room.currency} ${Number(room.base_price).toFixed(0)}`
                          : "On request"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {left === undefined ? "—" : left}
                      </TableCell>
                      <TableCell className="text-right">
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
          </div>
        </Card>
      )}
    </div>
  );
}
