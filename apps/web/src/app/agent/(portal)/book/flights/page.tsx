import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, PlaneTakeoff } from "lucide-react";
import type { FlightSearchResult } from "@sts/shared-types";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FlightSearchForm } from "@/modules/flights/components/flight-search-form";
import { FlightOfferCard } from "@/modules/flights/components/flight-offer-card";

export const metadata = { title: "Flights" };

type SearchParams = {
  origin?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
  trip_type?: string;
  adults?: string;
  cabin?: string;
};

export default async function AgentFlightDeskPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book?service=flights");

  const trpc = await getServerTrpc();
  const airports = await trpc.flights.airports.query().catch(() => []);
  const hasSearch = Boolean(params.origin && params.destination && params.depart_date);
  const adults = Math.min(Math.max(Number(params.adults) || customers.length, 1), 9);
  const cabin = params.cabin ?? customers[0].preferred_cabin ?? "economy";

  let result: FlightSearchResult | null = null;
  if (hasSearch) {
    result = await trpc.flights.search
      .mutate({
        origin: params.origin!.toUpperCase(),
        destination: params.destination!.toUpperCase(),
        departDate: params.depart_date!,
        returnDate: params.trip_type === "one_way" ? undefined : params.return_date || undefined,
        adults,
        cabinClass: cabin === "premium_economy" || cabin === "business" || cabin === "first" ? cabin : "economy",
      })
      .catch((): FlightSearchResult => ({ live: true, offers: [], providerError: "Flight search is unavailable right now. Try again shortly." }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flights"
        back={{ href: "/agent/book", label: "Services" }}
        meta={customers.length > 1 ? `${customers.length} customers` : customers[0].full_name}
      />

      <Card className="py-0">
        <FlightSearchForm
          airports={airports}
          defaults={{
            origin: params.origin,
            destination: params.destination,
            departDate: params.depart_date,
            returnDate: params.return_date,
            tripType: params.trip_type,
            adults: String(adults),
            cabin,
          }}
        />
      </Card>

      {result && result.offers.length > 0 ? (
        <div className="space-y-3">
          {result.offers.map((offer) => (
            <FlightOfferCard
              key={offer.id}
              offer={offer}
              action={
                <Button render={<Link href={`/agent/book/flights/${offer.id}`} />}>
                  Select <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              }
            />
          ))}
        </div>
      ) : hasSearch ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <PlaneTakeoff />
              </EmptyMedia>
              <EmptyTitle>
                {!result?.live ? "Flight booking is not connected" : (result.providerError ?? "No fares for this route and date")}
              </EmptyTitle>
            </Empty>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
