import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { searchHotels } from "@/modules/hotels/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Services
      </Link>

      <h1 className="font-heading text-2xl font-bold">Hotels</h1>

      <Card>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={city} placeholder="Mogadishu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input id="checkIn" name="checkIn" type="date" defaultValue={checkIn} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input id="checkOut" name="checkOut" type="date" defaultValue={checkOut} />
            </div>
            <Button type="submit" className="gap-1.5">
              <Search className="size-4" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {hotels.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {city ? `No hotels match “${city}”.` : "No hotels published yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hotel</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">From</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotels.map((hotel) => (
                  <TableRow key={hotel.id}>
                    <TableCell className="font-medium">{hotel.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{hotel.city}</TableCell>
                    <TableCell>
                      {hotel.star_rating ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Star className="size-3.5 fill-brand-gold text-brand-gold" />
                          {hotel.star_rating}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {hotel.minPrice
                        ? `${hotel.currency} ${Number(hotel.minPrice).toFixed(0)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link
                            href={`/agent/book/hotels/${hotel.slug}${stay ? `?${stay}` : ""}`}
                          />
                        }
                      >
                        Rooms
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
