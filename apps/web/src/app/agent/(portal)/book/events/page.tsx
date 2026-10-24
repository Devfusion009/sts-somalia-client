import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopper, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { Button } from "@/components/ui/button";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

export const metadata = { title: "Event halls" };

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
    return (
      <div className="space-y-6">
        <PageHeader title="Event halls" back={{ href: "/agent/book", label: "Services" }} />
        <UnavailableNotice label="Event halls" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Event halls" back={{ href: "/agent/book", label: "Services" }} />

      <form role="search" className="flex items-center gap-2">
        <InputGroup className="sm:w-72 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput name="city" defaultValue={city} placeholder="City" aria-label="Search by city" />
        </InputGroup>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        {venues.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <PartyPopper />
            </EmptyMedia>
            <EmptyTitle>{city ? `No venues match “${city}”` : "No venues"}</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead numeric>Capacity</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
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
                    <TableCell numeric className="text-sm">
                      {capacity ?? "—"}
                    </TableCell>
                    <TableCell numeric className="text-sm font-medium">
                      {price > 0 ? (
                        <>
                          {money(price, venue.currency)}
                          {venue.price_unit === "per_person" ? (
                            <span className="ml-1 font-normal text-muted-foreground">pp</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="font-normal text-muted-foreground">On request</span>
                      )}
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/agent/book/events/${venue.slug}`} />}
                      >
                        Select
                      </Button>
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
