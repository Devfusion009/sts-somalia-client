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
      {/* Hero — filled background image under a directional scrim, content on
          z-10, same construction as the visa, flights and Umrah heroes. The
          banquet photo is bright, so the scrim carries the text contrast on
          the left and lets the room show through on the right. */}
      <section className="relative isolate overflow-hidden bg-sidebar text-white">
        <Image
          src="/marketing/event-hall.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/85 to-sidebar/40 lg:via-sidebar/75 lg:to-sidebar/10"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sidebar/60 to-transparent" aria-hidden />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="font-heading text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Event halls <span className="text-brand-accent">across Somalia</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Weddings, conferences, graduations and community events. Compare capacity and price,
              then reserve online.
            </p>
            <form
              role="search"
              className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/30 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand-accent dark:bg-card"
            >
              {type ? <input type="hidden" name="type" value={type} /> : null}
              <MapPin className="ml-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                name="city"
                autoComplete="off"
                aria-label="City"
                placeholder="Mogadishu, Hargeisa…"
                defaultValue={city}
                className="h-12 min-w-0 border-0 bg-transparent px-1 text-base text-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button
                type="submit"
                size="lg"
                aria-label="Search venues"
                className="h-12 shrink-0 gap-2 rounded-xl bg-brand-accent px-6 text-base font-semibold text-brand-accent-foreground hover:bg-brand-accent/90 max-sm:size-12 max-sm:px-0"
              >
                <Search className="size-5" aria-hidden />
                <span className="max-sm:sr-only">Search</span>
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {type ? eventTypeLabel(type) : "All venues"}
            {city ? <span className="text-muted-foreground"> in {city}</span> : null}
          </h2>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {venues.length} {venues.length === 1 ? "venue" : "venues"}
          </p>
        </div>

        {eventTypes.length > 0 ? (
          <FilterChips
            label="Filter venues by event type"
            className="mb-8 border-b border-border pb-4 sm:-mx-0 sm:flex-nowrap sm:overflow-x-auto sm:pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            active={type ?? "all"}
            items={[
              { key: "all", label: "All events", href: city ? `/events?city=${encodeURIComponent(city)}` : "/events" },
              ...eventTypes.map((t) => ({
                key: t,
                label: eventTypeLabel(t),
                href: `/events?type=${encodeURIComponent(t)}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
              })),
            ]}
          />
        ) : null}

        {venues.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue) => {
              const amenities = Array.isArray(venue.amenities)
                ? (venue.amenities as string[]).slice(0, 3)
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
                  className="group rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Card className="h-full gap-0 overflow-hidden rounded-2xl py-0 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-foreground/[0.06]">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
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
                          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <MediaPlaceholder seed={venue.slug} icon={Landmark} className="absolute inset-0 size-full" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
                      {venue.is_featured ? (
                        <Badge className="absolute top-3 left-3 border-transparent bg-brand-accent text-brand-accent-foreground shadow-sm">
                          Featured
                        </Badge>
                      ) : null}
                      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        <MapPin className="size-3.5" aria-hidden /> {venue.city}
                      </span>
                    </div>

                    <CardContent className="flex flex-1 flex-col gap-4 p-5">
                      <div className="min-w-0">
                        <h3 className="truncate font-heading text-lg font-bold transition-colors group-hover:text-primary">
                          {venue.name}
                        </h3>
                        {venue.tagline ? (
                          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{venue.tagline}</p>
                        ) : null}
                      </div>

                      {venue.capacity_seated || venue.size_sqm ? (
                        <dl className="grid grid-cols-2 divide-x divide-border rounded-xl bg-muted/60 py-2.5 text-center">
                          <div className="px-2">
                            <dt className="flex items-center justify-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                              <Users className="size-3.5" aria-hidden /> Guests
                            </dt>
                            <dd className="mt-0.5 font-heading text-sm font-semibold tabular-nums">
                              {venue.capacity_seated
                                ? `${venue.capacity_seated}${venue.capacity_standing ? `–${venue.capacity_standing}` : ""}`
                                : "—"}
                            </dd>
                          </div>
                          <div className="px-2">
                            <dt className="flex items-center justify-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                              <Ruler className="size-3.5" aria-hidden /> Area
                            </dt>
                            <dd className="mt-0.5 font-heading text-sm font-semibold tabular-nums">
                              {venue.size_sqm ? `${Number(venue.size_sqm).toFixed(0)} m²` : "—"}
                            </dd>
                          </div>
                        </dl>
                      ) : null}

                      {types.length > 0 || amenities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {types.map((t) => (
                            <Badge key={t} className="border-transparent bg-secondary text-xs text-secondary-foreground">
                              {eventTypeLabel(t)}
                            </Badge>
                          ))}
                          {amenities.map((a) => (
                            <Badge key={a} variant="outline" className="text-xs font-normal text-muted-foreground">
                              {amenityInfo(a).label}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
                        <div className="min-w-0">
                          {Number(venue.base_price) > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground">From</p>
                              <p className="font-heading text-xl font-bold text-foreground tabular-nums">
                                {venueMoney(venue.currency, venue.base_price)}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}
                                  {priceUnitLabel(venue.price_unit)}
                                </span>
                              </p>
                            </>
                          ) : (
                            <p className="font-heading text-base font-bold text-foreground">Price on request</p>
                          )}
                        </div>
                        <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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
