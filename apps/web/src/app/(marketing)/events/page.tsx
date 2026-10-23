import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Landmark, MapPin, Ruler, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { getServerTrpc } from "@/lib/trpc/server";
import { venueImageUrls } from "@/modules/events/images";
import { amenityInfo, eventTypeLabel, priceUnitLabel, venueMoney } from "@/modules/events/components/amenities";

export const metadata: Metadata = { title: "Event & Hall Booking" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; type?: string }>;
}) {
  const { city, type } = await searchParams;
  const trpc = await getServerTrpc();
  let venues, eventTypes;
  try {
    [venues, eventTypes] = await Promise.all([
      trpc.events.venues.query({ city, eventType: type }),
      trpc.events.venueEventTypes.query(),
    ]);
  } catch {
    return <UnavailableNotice label="Events & Halls" />;
  }

  return (
    <div>
      {/* Hero — same construction as VisaHeroBanner, FlightsHero and the Umrah
          page: a filled background image under a directional scrim, content on
          z-10. */}
      <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
        <Image
          src="/marketing/events-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          // The artwork's floral stage sits right and its left is an empty
          // dance floor; narrow screens crop too hard to rely on that, so they
          // centre instead and only lg favours the right.
          className="object-cover object-center lg:object-right"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/70 lg:via-sidebar/85 lg:to-sidebar/35"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Events &amp; Halls
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Event halls <span className="text-brand-accent">across Somalia</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              Weddings, conferences, graduations and community events. Compare capacity and price,
              then reserve online.
            </p>
            <form className="mt-7 flex max-w-lg gap-2 rounded-2xl bg-background/95 p-2 shadow-lg">
              <Input
                name="city"
                autoComplete="off"
                placeholder="Search by city (e.g. Mogadishu, Hargeisa)"
                defaultValue={city}
                className="border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="lg" className="shrink-0 gap-1.5">
                <Search className="size-4" /> Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Event-type filter chips */}
        {eventTypes.length > 0 ? (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Link
              href="/events"
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              All Events
            </Link>
            {eventTypes.map((t) => (
              <Link
                key={t}
                href={`/events?type=${encodeURIComponent(t)}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  type === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {eventTypeLabel(t)}
              </Link>
            ))}
          </div>
        ) : null}

        {venues.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue) => {
              const amenities = Array.isArray(venue.amenities)
                ? (venue.amenities as string[]).slice(0, 4)
                : [];
              const types = Array.isArray(venue.event_types)
                ? (venue.event_types as string[]).slice(0, 3)
                : [];
              // Index 0 is the cover shot, matching the umrah/hotels convention.
              const cover = venueImageUrls(venue.images)[0] ?? null;
              return (
                <Link key={venue.id} href={`/events/${venue.slug}`} className="group">
                  <Card className="h-full overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="relative">
                      {cover ? (
                        // Venue photography can be either a repo asset or a
                        // Storage URL, so this stays a plain <img>: next/image
                        // would need the Supabase host allow-listed in
                        // next.config.ts for admin-uploaded covers.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" className="h-44 w-full object-cover" />
                      ) : (
                        <MediaPlaceholder seed={venue.slug} icon={Landmark} className="h-44 w-full" />
                      )}
                      {venue.is_featured ? (
                        <Badge className="absolute top-3 left-3 border-transparent bg-brand-accent text-brand-accent-foreground">
                          Featured
                        </Badge>
                      ) : null}
                    </div>
                    <CardContent className="flex h-full flex-col gap-3 p-5 pt-4 pb-6">
                      <div>
                        <h3 className="font-heading text-lg font-bold group-hover:text-primary">
                          {venue.name}
                        </h3>
                        {venue.tagline ? (
                          <p className="text-sm text-muted-foreground">{venue.tagline}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5" /> {venue.city}
                        </span>
                        {venue.capacity_seated ? (
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" /> {venue.capacity_seated} seated
                            {venue.capacity_standing ? ` · ${venue.capacity_standing} standing` : ""}
                          </span>
                        ) : null}
                        {venue.size_sqm ? (
                          <span className="flex items-center gap-1">
                            <Ruler className="size-3.5" /> {Number(venue.size_sqm).toFixed(0)} m²
                          </span>
                        ) : null}
                      </div>

                      {types.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {types.map((t) => (
                            <Badge
                              key={t}
                              className="border-transparent bg-secondary text-xs text-secondary-foreground"
                            >
                              {eventTypeLabel(t)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      {amenities.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {amenities.map((a) => amenityInfo(a).label).join(" · ")}
                        </p>
                      ) : null}

                      <div className="mt-auto flex items-end justify-between pt-2">
                        <div>
                          {Number(venue.base_price) > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground">From</p>
                              <p className="font-heading text-lg font-bold text-primary">
                                {venueMoney(venue.currency, venue.base_price)}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}
                                  {priceUnitLabel(venue.price_unit)}
                                </span>
                              </p>
                            </>
                          ) : (
                            <p className="font-heading text-sm font-bold text-primary">Price on request</p>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                          View Venue <ArrowRight className="size-4" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No venues found{city ? ` in "${city}"` : ""}{type ? ` for ${eventTypeLabel(type)}` : ""}.{" "}
              <Link href="/events" className="text-primary hover:underline">
                View all venues
              </Link>
              .
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
