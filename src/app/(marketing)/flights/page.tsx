import type { Metadata } from "next";
import Link from "next/link";
import { PlaneTakeoff, Mail, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchFlightOffers } from "@/lib/data/flights";
import { getCurrentProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Flights" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; destination?: string; depart_date?: string }>;
}) {
  const { origin, destination, depart_date } = await searchParams;
  const [offers, profile] = await Promise.all([
    searchFlightOffers({ origin, destination, departDate: depart_date }),
    getCurrentProfile(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">Flights</h1>
        <p className="mt-1 text-muted-foreground">International and local routes across East Africa and beyond.</p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-4 sm:p-6">
          <form className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="origin">From</Label>
              <Input id="origin" name="origin" placeholder="MGQ" defaultValue={origin} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination">To</Label>
              <Input id="destination" name="destination" placeholder="DXB" defaultValue={destination} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="depart_date">Departure date</Label>
              <div className="flex gap-2">
                <Input id="depart_date" name="depart_date" type="date" defaultValue={depart_date} />
                <Button type="submit">
                  <Search /> Search
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {offers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Departs</TableHead>
                  <TableHead>Arrives</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Cabin</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">
                      {offer.origin_iata} → {offer.destination_iata}
                    </TableCell>
                    <TableCell>{formatDateTime(offer.depart_at)}</TableCell>
                    <TableCell>{formatDateTime(offer.arrive_at)}</TableCell>
                    <TableCell>{offer.airlines?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{offer.cabin_class}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {offer.currency} {offer.price.toFixed(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PlaneTakeoff className="size-7" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-semibold">Live flight search is coming soon</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                We&apos;re connecting to international flight providers. In the meantime, our team can find and
                book the best fare for you directly — just send us your route and dates.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button render={<a href="mailto:support@sts-somalia.example?subject=Flight%20quote%20request" />}>
                <Mail /> Request a manual quote
              </Button>
              {!profile ? (
                <Button variant="outline" render={<Link href="/signup" />}>
                  Create an account
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
