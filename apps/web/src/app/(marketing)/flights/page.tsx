import type { Metadata } from "next";
import {
  BadgePercent,
  Clock3,
  Headset,
  Luggage,
  MoveRight,
  Plane,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlightsHero } from "@/components/marketing/flights-hero";
import { FlightDealsRail } from "@/components/marketing/flight-deals-rail";
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
import { searchLiveFlights, type FlightSearchResult } from "@/modules/flights/provider";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  FlightSearchForm,
  type FlightSearchDefaults,
} from "@/modules/flights/components/flight-search-form";
import { QuoteRequestForm } from "@/modules/flights/components/quote-request-form";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";

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

const TRUST_POINTS = [
  { icon: BadgePercent, text: "Fair, transparent fares" },
  { icon: ShieldCheck, text: "IATA-experienced booking team" },
  { icon: Headset, text: "24/7 support before and during travel" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatPenalty(penalty: { amount: number; currency: string } | null) {
  if (!penalty) return null;
  return `${penalty.currency} ${penalty.amount.toFixed(0)} fee`;
}

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
  const [airports, profile] = await Promise.all([
    trpc.flights.airports.query().catch(() => []),
    getCurrentProfile(),
  ]);

  let result: FlightSearchResult | null = null;
  if (hasSearch) {
    result = await searchLiveFlights({
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
    });
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
        <ul className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
          {TRUST_POINTS.map((point) => (
            <li key={point.text} className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground/75">
              <point.icon className="size-4 text-sidebar-primary" /> {point.text}
            </li>
          ))}
        </ul>
      </FlightsHero>

      {/* Discovery content only when the visitor hasn't searched yet. */}
      {!hasSearch ? (
        <>
          <FlightDealsRail title="Travel deals under $500" href="/hotels" deals={FLIGHT_DEALS} />
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-10">
          {!hasSearch ? null : result && result.live && result.offers.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold">
                  {params.origin!.toUpperCase()} <MoveRight className="inline size-4" />{" "}
                  {params.destination!.toUpperCase()}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {result.offers.length} fares found
                  </span>
                </h2>
              </div>
              {result.offers.map((offer) => {
                const hasFareDetail =
                  offer.refundPenalty || offer.changePenalty || offer.refundable === false || offer.changeable === false;
                return (
                  <Card key={offer.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
                      <div className="min-w-32">
                        <p className="text-sm font-bold">{offer.airline}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {offer.cabinClass.replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex flex-1 items-center gap-4">
                        <div className="text-right">
                          <p className="font-heading text-lg font-bold">{formatTime(offer.departAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.origin} · {formatDate(offer.departAt)}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-col items-center px-2">
                          <p className="text-[10px] text-muted-foreground">
                            {formatDuration(offer.durationMinutes)}
                          </p>
                          <div className="relative h-px w-full min-w-16 bg-border">
                            <Plane className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 text-primary" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {offer.stops === 0 ? "Non-stop" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <div>
                          <p className="font-heading text-lg font-bold">{formatTime(offer.arriveAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.destination} · {formatDate(offer.arriveAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-xl font-bold text-primary">
                          {offer.currency} {offer.totalAmount.toFixed(0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">total, all passengers</p>
                      </div>

                      <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-3">
                        {offer.checkedBagsIncluded !== null ? (
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                            <Luggage className="size-3" />
                            {offer.checkedBagsIncluded === 0
                              ? "Carry-on only"
                              : `${offer.checkedBagsIncluded} checked bag${offer.checkedBagsIncluded > 1 ? "s" : ""}`}
                          </Badge>
                        ) : null}
                        {offer.refundable !== null ? (
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                            <ShieldCheck className="size-3" />
                            {offer.refundable ? "Refundable" : "Non-refundable"}
                          </Badge>
                        ) : null}
                        {offer.changeable !== null ? (
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                            <RefreshCcw className="size-3" />
                            {offer.changeable ? "Changeable" : "No changes"}
                          </Badge>
                        ) : null}
                      </div>

                      {hasFareDetail ? (
                        <details className="w-full text-xs">
                          <summary className="cursor-pointer font-medium text-primary">
                            Fare rules
                          </summary>
                          <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                            <li>
                              {offer.refundable
                                ? `Refundable${formatPenalty(offer.refundPenalty) ? ` — ${formatPenalty(offer.refundPenalty)}` : ""}`
                                : "No refunds before departure"}
                            </li>
                            <li>
                              {offer.changeable
                                ? `Changes allowed${formatPenalty(offer.changePenalty) ? ` — ${formatPenalty(offer.changePenalty)}` : ""}`
                                : "No changes before departure"}
                            </li>
                          </ul>
                        </details>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="border-dashed">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold">Want us to book one of these fares?</p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Send a quote request and our team will hold the fare and arrange payment.
                  </p>
                  <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} bookedForSlot={<AgencyBookingSlot />} />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="mx-auto max-w-2xl">
              <CardHeader className="items-center text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
                  <Clock3 className="size-6" />
                </span>
                <CardTitle className="font-heading text-xl">
                  {result?.live
                    ? (result.providerError ?? "No live fares found for this route and date")
                    : "Live fares for this route are coming online soon"}
                </CardTitle>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Our booking team finds fares that never show up in public searches — request a
                  quote and we&apos;ll send options for{" "}
                  <span className="font-medium text-foreground">
                    {params.origin?.toUpperCase()} → {params.destination?.toUpperCase()}
                  </span>{" "}
                  within a few hours.
                </p>
              </CardHeader>
              <CardContent>
                <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} bookedForSlot={<AgencyBookingSlot />} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
