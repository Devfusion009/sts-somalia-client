import type { Metadata } from "next";
import { Clock3, Luggage, MoveRight, Plane, RefreshCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlightsHero } from "@/components/marketing/flights-hero";
import { FlightDiscovery } from "@/components/marketing/flight-discovery";
import { TrendingGrid } from "@/components/marketing/trending-grid";
import { DealsByDestination, FlightsFaq } from "@/components/marketing/flight-accordions";
import { jsonLdScript } from "@/lib/json-ld";
import {
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
import { AgencyBookingSlot, viewerAgencyId } from "@/modules/agencies/components/agency-booking-slot";

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

// Duffel times are the airport's local wall clock with no offset
// ("2026-11-21T09:45:00"). Read them as-is — converting through the server's
// timezone would shift every flight on a server that isn't on that zone.
function formatTime(iso: string) {
  return iso.slice(11, 16);
}

function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(amount: number) {
  return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatPenalty(penalty: { amount: number; currency: string } | null) {
  if (!penalty) return null;
  return `${penalty.currency} ${formatMoney(penalty.amount)} fee`;
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
  const [airports, profile, viewerAgency] = await Promise.all([
    trpc.flights.airports.query().catch(() => []),
    getCurrentProfile(),
    viewerAgencyId(),
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

      <FlightsHero compact={hasSearch}>
        <FlightSearchForm key={JSON.stringify(defaults)} airports={airports} defaults={defaults} />
      </FlightsHero>

      {/* Discovery content only when the visitor hasn't searched yet. */}
      {!hasSearch ? (
        <>
          <FlightDiscovery />
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
              {result.offers.map((offer) => {
                const hasFareDetail =
                  offer.refundPenalty || offer.changePenalty || offer.refundable === false || offer.changeable === false;
                return (
                  <Card key={offer.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 sm:p-5">
                      <div className="min-w-32">
                        <p className="text-sm font-bold">{offer.airline}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {offer.cabinClass.replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3 sm:gap-4">
                        <div className="text-right">
                          <p className="font-heading text-lg font-bold tabular-nums">{formatTime(offer.departAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.origin} · {formatDate(offer.departAt)}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-col items-center px-2">
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDuration(offer.durationMinutes)}
                          </p>
                          <div className="relative h-px w-full min-w-16 bg-border">
                            <Plane className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 text-primary" aria-hidden />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {offer.stops === 0 ? "Non-stop" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <div>
                          <p className="font-heading text-lg font-bold tabular-nums">{formatTime(offer.arriveAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.destination} · {formatDate(offer.arriveAt)}
                          </p>
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="font-heading text-xl font-bold text-primary tabular-nums">
                          {offer.currency} {formatMoney(offer.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">total, all passengers</p>
                      </div>

                      {offer.returnLeg ? (
                        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                          <span className="w-16 text-xs font-medium text-muted-foreground">Return</span>
                          <span className="font-semibold tabular-nums">{formatTime(offer.returnLeg.departAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {offer.destination} · {formatDate(offer.returnLeg.departAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(offer.returnLeg.durationMinutes)} ·{" "}
                            {offer.returnLeg.stops === 0
                              ? "Non-stop"
                              : `${offer.returnLeg.stops} stop${offer.returnLeg.stops > 1 ? "s" : ""}`}
                          </span>
                          <span className="font-semibold tabular-nums">{formatTime(offer.returnLeg.arriveAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {offer.origin} · {formatDate(offer.returnLeg.arriveAt)}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-3">
                        {offer.checkedBagsIncluded !== null ? (
                          <Badge variant="outline" className="gap-1 text-xs font-normal">
                            <Luggage className="size-3" aria-hidden />
                            {offer.checkedBagsIncluded === 0
                              ? "Carry-on only"
                              : `${offer.checkedBagsIncluded} checked bag${offer.checkedBagsIncluded > 1 ? "s" : ""}`}
                          </Badge>
                        ) : null}
                        {offer.refundable !== null ? (
                          <Badge variant="outline" className="gap-1 text-xs font-normal">
                            <ShieldCheck className="size-3" aria-hidden />
                            {offer.refundable ? "Refundable" : "Non-refundable"}
                          </Badge>
                        ) : null}
                        {offer.changeable !== null ? (
                          <Badge variant="outline" className="gap-1 text-xs font-normal">
                            <RefreshCcw className="size-3" aria-hidden />
                            {offer.changeable ? "Changeable" : "No changes"}
                          </Badge>
                        ) : null}
                      </div>

                      {hasFareDetail ? (
                        <details className="w-full text-xs">
                          <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-sm font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-base">Book one of these fares</CardTitle>
                </CardHeader>
                <CardContent>
                  <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} bookedForSlot={viewerAgency ? <AgencyBookingSlot /> : null} />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="mx-auto max-w-2xl">
              <CardHeader className="items-center text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Clock3 className="size-5" aria-hidden />
                </span>
                <CardTitle className="font-heading text-xl text-balance">
                  {result?.live
                    ? (result.providerError ?? "No live fares for this route and date")
                    : "Request a quote for this route"}
                </CardTitle>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {params.origin?.toUpperCase()} → {params.destination?.toUpperCase()}
                </p>
              </CardHeader>
              <CardContent>
                <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} bookedForSlot={viewerAgency ? <AgencyBookingSlot /> : null} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
