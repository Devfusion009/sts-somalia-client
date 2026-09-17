import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { Button } from "@/components/ui/button";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AgentEventDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city = "" } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book");

  const trpc = await getServerTrpc();
  let venues;
  try {
    venues = await trpc.events.venues.query({ city: city || undefined });
  } catch {
    return <UnavailableNotice label="Event halls" />;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Services
      </Link>

      <h1 className="font-heading text-2xl font-bold">Event halls</h1>

      <form className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="city" defaultValue={city} placeholder="Search city" className="pl-9" />
      </form>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {city ? `No venues match “${city}”.` : "No venues published yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => {
                  const capacity = venue.capacity_standing ?? venue.capacity_seated;
                  const price = Number(venue.base_price);
                  return (
                    <TableRow key={venue.id}>
                      <TableCell className="font-medium">{venue.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{venue.city}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {capacity ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {price > 0
                          ? `${venue.currency} ${price.toFixed(0)}${
                              venue.price_unit === "per_person" ? " pp" : ""
                            }`
                          : "On request"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/agent/book/events/${venue.slug}`} />}
                        >
                          Open
                        </Button>
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
