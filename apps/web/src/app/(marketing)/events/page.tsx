import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Landmark, MapPin, Ruler, Search, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {type ? eventTypeLabel(type) : "All venues"}
            {city ? <span className="text-muted-foreground"> in {city}</span> : null}
          </h2>
          <p className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground tabular-nums">
            {venues.length} {venues.length === 1 ? "venue" : "venues"}
          </p>
        </div>

        {eventTypes.length > 0 ? (
          <FilterChips
            label="Filter venues by event type"
            className="mb-8 mx-0 flex-wrap overflow-visible rounded-xl border border-border bg-card p-3 sm:p-3 [&>a]:h-10 [&>a]:rounded-lg [&>a]:px-4"
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
                  className="group block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Card className="h-full gap-0 overflow-hidden rounded-2xl border-border/80 bg-card py-0 shadow-sm transition-[border-color,box-shadow] duration-200 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5 motion-reduce:transition-none">
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary/5 text-primary/70">
                          <span className="grid size-16 place-items-center rounded-2xl border border-primary/10 bg-card/80"><Landmark className="size-8" strokeWidth={1.25} aria-hidden /></span>
                          <span className="text-sm font-medium text-muted-foreground">Photo unavailable</span>
                        </div>
                      )}
                      {venue.is_featured ? (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#155e54] shadow-sm">
                          <Sparkles className="size-3.5" aria-hidden /> Featured
                        </span>
                      ) : null}
                    </div>

                    <CardContent className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />{venue.city}</div>
                        <h3 className="min-h-14 font-heading text-xl leading-7 font-semibold tracking-tight text-balance transition-colors group-hover:text-primary">
                          {venue.name}
                        </h3>
                        {venue.tagline ? (
                          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{venue.tagline}</p>
                        ) : <div className="mt-2 min-h-10" aria-hidden />}
                      </div>

                      <dl className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border/70 bg-muted/30 py-3">
                          <div className="px-4">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Users className="size-3.5" aria-hidden /> Guests
                            </dt>
                            <dd className="mt-1.5 font-heading text-base font-semibold tabular-nums">
                              {venue.capacity_seated
                                ? `${venue.capacity_seated}${venue.capacity_standing ? `–${venue.capacity_standing}` : ""}`
                                : "On request"}
                            </dd>
                          </div>
                          <div className="px-4">
                            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Ruler className="size-3.5" aria-hidden /> Area
                            </dt>
                            <dd className="mt-1.5 font-heading text-base font-semibold tabular-nums">
                              {venue.size_sqm ? `${Number(venue.size_sqm).toFixed(0)} m²` : "On request"}
                            </dd>
                          </div>
                      </dl>

                      {types.length > 0 ? (
                        <div className="flex min-h-7 flex-wrap items-start gap-1.5">
                          {types.map((t) => (
                            <Badge key={t} className="rounded-md border-transparent bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
                              {eventTypeLabel(t)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      {amenities.length > 0 ? <p className="text-xs leading-5 text-muted-foreground">{amenities.map(a => amenityInfo(a).label).join(" · ")}</p> : null}
                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
                        <div className="min-w-0">
                          {Number(venue.base_price) > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground">From</p>
                              <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
                                {venueMoney(venue.currency, venue.base_price)}
                                <span className="mt-0.5 block text-xs font-normal tracking-normal text-muted-foreground">
                                  {" "}
                                  {priceUnitLabel(venue.price_unit)}
                                </span>
                              </p>
                            </>
                          ) : (
                            <p className="font-heading text-base font-bold text-foreground">Price on request</p>
                          )}
                        </div>
                        <span className="inline-flex h-11 shrink-0 items-center rounded-lg border border-primary/15 bg-primary/5 px-4 text-sm font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                          View venue
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
