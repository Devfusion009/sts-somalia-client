import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle, MoveRight, Phone, PlaneTakeoff } from "lucide-react";
import type { FlightSearchResult } from "@sts/shared-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlightsHero } from "@/components/marketing/flights-hero";
import { FlightDealsRail } from "@/components/marketing/flight-deals-rail";
import { FlightBookingPoster } from "@/components/marketing/flight-booking-poster";
import { TravelProsCards } from "@/components/marketing/travel-pros-cards";
import { TrendingGrid } from "@/components/marketing/trending-grid";
import { DealsByDestination, FlightsFaq } from "@/components/marketing/flight-accordions";
import { jsonLdScript } from "@/lib/json-ld";
import {
  FLIGHT_DEALS,
  TRENDING_CITIES,
  TRENDING_COUNTRIES,
  DEAL_GROUPS,
  FLIGHT_FAQS,
} from "@/components/marketing/flights-data";
import { getServerTrpc } from "@/lib/trpc/server";
import {
  FlightSearchForm,
  type FlightSearchDefaults,
} from "@/modules/flights/components/flight-search-form";
import { FlightOfferCard } from "@/modules/flights/components/flight-offer-card";

export const metadata: Metadata = { title: "Flights" };

const faqJsonLd = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    origin?: string;
    destination?: string;
    depart_date?: string;
    return_date?: string;
    trip_type?: string;
    adults?: string;
    cabin?: string;
  }>;
}) {
  const params = await searchParams;
  const defaults: FlightSearchDefaults = {
    origin: params.origin,
    destination: params.destination,
    departDate: params.depart_date,
    returnDate: params.return_date,
    tripType: params.trip_type,
    adults: params.adults,
    cabin: params.cabin,
  };

  const hasSearch = Boolean(params.origin && params.destination && params.depart_date);
  const trpc = await getServerTrpc();
  const airports = await trpc.flights.airports.query().catch(() => []);

  let result: FlightSearchResult | null = null;
  if (hasSearch) {
    result = await trpc.flights.search.mutate({
      origin: params.origin!.toUpperCase(),
      destination: params.destination!.toUpperCase(),
      departDate: params.depart_date!,
      returnDate: params.trip_type === "one_way" ? undefined : params.return_date || undefined,
      adults: Math.min(Math.max(Number(params.adults) || 1, 1), 9),
      cabinClass:
        params.cabin === "premium_economy" ||
        params.cabin === "business" ||
        params.cabin === "first"
          ? params.cabin
          : "economy",
    }).catch((): FlightSearchResult => ({ live: true, offers: [], providerError: "Flight search is unavailable right now. Try again shortly." }));
  }

  return (
    <div>
      {!hasSearch ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FLIGHT_FAQS)) }}
        />
      ) : null}

      <FlightsHero>
        <FlightSearchForm airports={airports} defaults={defaults} />
      </FlightsHero>

      {/* Discovery content only when the visitor hasn't searched yet. */}
      {!hasSearch ? (
        <>
          <FlightDealsRail title="Where will you fly next?" href="#flight-search" deals={FLIGHT_DEALS} />
          <FlightBookingPoster />
          <TravelProsCards />
          <TrendingGrid
            title="Trending cities"
            subtitle="The routes most searched by travellers from Somalia"
            entries={TRENDING_CITIES}
          />
          <TrendingGrid
            title="Trending countries"
            subtitle="Where Somali travellers fly most"
            entries={TRENDING_COUNTRIES}
          />
          <DealsByDestination groups={DEAL_GROUPS} />
          <FlightsFaq faqs={FLIGHT_FAQS} />
        </>
      ) : null}

      {hasSearch ? (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-10">
          {result && result.live && result.offers.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
                  {params.origin!.toUpperCase()} <MoveRight className="size-4" aria-label="to" />
                  {params.destination!.toUpperCase()}
                </h2>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {result.offers.length} fare{result.offers.length === 1 ? "" : "s"}
                </p>
              </div>
              {result.offers.map((offer) => (
                <FlightOfferCard
                  key={offer.id}
                  offer={offer}
                  action={
                    <Button render={<Link href={`/flights/book/${offer.id}`} />}>
                      Select <ArrowRight data-icon="inline-end" aria-hidden="true" />
                    </Button>
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="mx-auto max-w-2xl">
              <CardHeader className="items-center text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PlaneTakeoff className="size-5" aria-hidden />
                </span>
                <CardTitle className="font-heading text-xl text-balance">
                  {!result?.live
                    ? "Online flight booking opens soon"
                    : (result.providerError ?? "No fares for this route and date")}
                </CardTitle>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {params.origin?.toUpperCase()} → {params.destination?.toUpperCase()}
                </p>
              </CardHeader>
              {!result?.live ? (
                <CardContent className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" render={<a href="tel:+252611444420" />}>
                    <Phone aria-hidden="true" /> +252 611 444 420
                  </Button>
                  <Button render={<a href="https://wa.me/252611444420" target="_blank" rel="noopener noreferrer" />}>
                    <MessageCircle aria-hidden="true" /> WhatsApp
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
