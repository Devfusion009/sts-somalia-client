import type { Metadata } from "next";
import {
  BadgePercent,
  Clock3,
  Headset,
  MoveRight,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAirports } from "@/modules/flights/queries";
import { searchLiveFlights, type FlightSearchResult } from "@/modules/flights/provider";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  FlightSearchForm,
  type FlightSearchDefaults,
} from "@/modules/flights/components/flight-search-form";
import { QuoteRequestForm } from "@/modules/flights/components/quote-request-form";

export const metadata: Metadata = { title: "Flights" };

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
  const [airports, profile] = await Promise.all([getAirports(), getCurrentProfile()]);

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
      {/* Hero + search */}
      <section className="bg-gradient-to-br from-sidebar via-sidebar to-primary/40 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 pt-14 pb-24 sm:px-6 lg:px-8">
          <Badge className="border-transparent bg-primary/20 text-primary-foreground">Flights</Badge>
          <h1 className="mt-4 max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Fly anywhere, <span className="text-brand-accent">from anywhere in Somalia</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-sidebar-foreground/80">
            International and regional routes with honest fares — booked and supported by a local
            team that knows the journey.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                <point.icon className="size-4 text-primary" /> {point.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-14">
          <FlightSearchForm airports={airports} defaults={defaults} />
        </div>

        <div className="py-10">
          {!hasSearch ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: PlaneTakeoff,
                  title: "Popular: Mogadishu → Dubai",
                  text: "Daily connections via regional hubs.",
                },
                {
                  icon: Plane,
                  title: "Umrah season fares",
                  text: "Ask about Jeddah & Medina group rates.",
                },
                {
                  icon: PlaneLanding,
                  title: "Regional routes",
                  text: "Hargeisa, Nairobi, Addis Ababa and more.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="flex items-start gap-3 p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                      <item.icon className="size-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : result && result.live && result.offers.length > 0 ? (
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
              {result.offers.map((offer) => (
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
                  </CardContent>
                </Card>
              ))}
              <Card className="border-dashed">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold">Want us to book one of these fares?</p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Send a quote request and our team will hold the fare and arrange payment.
                  </p>
                  <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} />
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
                <QuoteRequestForm defaults={defaults} signedIn={Boolean(profile)} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
