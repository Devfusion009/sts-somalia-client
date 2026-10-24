import Link from "next/link";
import { redirect } from "next/navigation";
import { Hotel, Search, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { searchHotels } from "@/modules/hotels/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Hotels" };

export default async function AgentHotelDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { city = "", checkIn = "", checkOut = "", guests = "" } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book");

  // Dates are carried to the room step rather than into the search: blending
  // live supplier offers here would list rooms this desk can't yet book.
  const hotels = await searchHotels({ city: city || undefined });
  const stay = new URLSearchParams(
    Object.entries({ checkIn, checkOut, guests }).filter(([, value]) => value)
  ).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Hotels" back={{ href: "/agent/book", label: "Services" }} />

      <Card>
        <CardContent>
          <form
            role="search"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end"
          >
            <Field className="sm:col-span-2 lg:col-span-1">
              <FieldLabel htmlFor="city">City</FieldLabel>
              <Input id="city" name="city" defaultValue={city} placeholder="Mogadishu" />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkIn">Check-in</FieldLabel>
              <Input id="checkIn" name="checkIn" type="date" defaultValue={checkIn} />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkOut">Check-out</FieldLabel>
              <Input id="checkOut" name="checkOut" type="date" defaultValue={checkOut} min={checkIn || undefined} />
            </Field>
            <Button type="submit" className="sm:col-span-2 lg:col-span-1">
              <Search data-icon="inline-start" aria-hidden="true" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        {hotels.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Hotel />
            </EmptyMedia>
            <EmptyTitle>{city ? `No hotels match “${city}”` : "No hotels"}</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead numeric>From</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotels.map((hotel) => (
                <TableRow key={hotel.id}>
                  <TableCell className="font-medium">{hotel.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{hotel.city}</TableCell>
                  <TableCell>
                    {hotel.star_rating ? (
                      <span className="flex items-center gap-1 text-sm" aria-label={`${hotel.star_rating} stars`}>
                        <Star className="size-3.5 fill-brand-gold text-brand-gold" aria-hidden="true" />
                        {hotel.star_rating}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell numeric className="text-sm font-medium">
                    {hotel.minPrice ? (
                      money(Number(hotel.minPrice), hotel.currency)
                    ) : (
                      <span className="font-normal text-muted-foreground">On request</span>
                    )}
                  </TableCell>
                  <TableCell numeric>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/agent/book/hotels/${hotel.slug}${stay ? `?${stay}` : ""}`} />}
                    >
                      Rooms
                    </Button>
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
