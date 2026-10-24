import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Landmark, MapPin, Ruler, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterChips } from "@/components/dashboard/filter-chips";
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
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Event halls <span className="text-brand-accent">across Somalia</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              Weddings, conferences, graduations and community events. Compare capacity and price,
              then reserve online.
            </p>
            <form
              role="search"
              className="mt-7 flex max-w-lg gap-2 rounded-2xl bg-background/95 p-2 shadow-lg focus-within:ring-2 focus-within:ring-ring"
            >
              <Input
                name="city"
                autoComplete="off"
                aria-label="City"
                placeholder="Mogadishu, Hargeisa…"
                defaultValue={city}
                className="h-11 min-w-0 border-0 bg-transparent text-base text-foreground shadow-none focus-visible:ring-0 sm:text-sm dark:bg-transparent"
              />
              <Button type="submit" size="lg" aria-label="Search venues" className="h-11 shrink-0 gap-1.5 px-4 max-sm:size-11 max-sm:px-0">
                <Search className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Search</span>
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Event-type filter chips */}
        {eventTypes.length > 0 ? (
          <FilterChips
            label="Filter venues by event type"
            className="mb-8"
            active={type ?? "all"}
            items={[
              { key: "all", label: "All events", href: "/events" },
              ...eventTypes.map((t) => ({
                key: t,
                label: eventTypeLabel(t),
                href: `/events?type=${encodeURIComponent(t)}`,
              })),
            ]}
          />
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
                <Link
                  key={venue.id}
                  href={`/events/${venue.slug}`}
                  className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Card className="h-full overflow-hidden py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                    <div className="relative overflow-hidden bg-muted">
                      {cover ? (
                        // Venue photography can be either a repo asset or a
                        // Storage URL, so this stays a plain <img>: next/image
                        // would need the Supabase host allow-listed in
                        // next.config.ts for admin-uploaded covers.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <MediaPlaceholder seed={venue.slug} icon={Landmark} className="h-44 w-full" />
                      )}
                      {venue.is_featured ? (
                        <Badge className="absolute top-3 left-3 border-transparent bg-brand-accent text-brand-accent-foreground">
                          Featured
                        </Badge>
                      ) : null}
                    </div>
                    <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-4">
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
                          <MapPin className="size-3.5" aria-hidden /> {venue.city}
                        </span>
                        {venue.capacity_seated ? (
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" aria-hidden /> {venue.capacity_seated} seated
                            {venue.capacity_standing ? ` · ${venue.capacity_standing} standing` : ""}
                          </span>
                        ) : null}
                        {venue.size_sqm ? (
                          <span className="flex items-center gap-1">
                            <Ruler className="size-3.5" aria-hidden /> {Number(venue.size_sqm).toFixed(0)} m²
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
                              <p className="font-heading text-lg font-bold text-primary tabular-nums">
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
                          View venue <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Landmark />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                No venues{city ? ` in ${city}` : ""}
                {type ? ` for ${eventTypeLabel(type)}` : ""}
              </EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" render={<Link href="/events" />}>
                View all venues
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  );
}
