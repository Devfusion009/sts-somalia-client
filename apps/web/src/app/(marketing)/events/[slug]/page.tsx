import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landmark, MapPin, Phone } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { PropertyLinks } from "@/components/property-links";
import { PropertyReviews } from "@/components/property-reviews";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { getServerTrpc } from "@/lib/trpc/server";
import { venueImageUrls } from "@/modules/events/images";
import {
  amenityInfo,
  eventTypeLabel,
  priceUnitLabel,
  venueMoney,
} from "@/modules/events/components/amenities";
import { venueCapacity } from "@sts/shared-types";
import { HallBookingForm } from "@/modules/events/components/booking-form";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trpc = await getServerTrpc();
  try {
    const venue = await trpc.events.venueBySlug.query({ slug });
    return { title: venue?.name ?? "Venue" };
  } catch {
    return { title: "Venue" };
  }
}

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trpc = await getServerTrpc();
  let venue;
  try {
    venue = await trpc.events.venueBySlug.query({ slug });
  } catch {
    return <UnavailableNotice label="Venue" />;
  }
  if (!venue) notFound();

  const amenities = Array.isArray(venue.amenities) ? (venue.amenities as string[]) : [];
  const gallery = venueImageUrls(venue.images);
  const eventTypes = Array.isArray(venue.event_types) ? (venue.event_types as string[]) : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb
        className="mb-4"
        items={[{ label: "Events & Halls", href: "/events" }, { label: venue.name }]}
      />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl">
        {gallery[0] ? (
          // Either a repo asset or a Storage URL — see the note on the venue
          // card; next/image would need the Supabase host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery[0]} alt={venue.name} fetchPriority="high" className="h-56 w-full object-cover sm:h-72" />
        ) : (
          <MediaPlaceholder seed={venue.slug} icon={Landmark} className="h-56 w-full sm:h-72" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" aria-hidden />
        <div className="absolute right-0 bottom-0 left-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {venue.is_featured ? (
                <Badge className="mb-2 border-transparent bg-brand-accent text-brand-accent-foreground">
                  Featured
                </Badge>
              ) : null}
              <h1 className="font-heading text-2xl font-bold tracking-tight text-balance text-white sm:text-3xl">
                {venue.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {venue.address ? `${venue.address}, ` : ""}
                {venue.city}
              </p>
              {venue.phone ? (
                <a
                  href={`tel:${venue.phone}`}
                  className="mt-1 inline-flex items-center gap-1 rounded-sm text-sm text-white/85 tabular-nums hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <Phone className="size-3.5" aria-hidden /> {venue.phone}
                </a>
              ) : null}
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-right backdrop-blur">
              {Number(venue.base_price) > 0 ? (
                <>
                  <p className="text-xs text-white/70">From</p>
                  <p className="font-heading text-xl font-bold text-white tabular-nums">
                    {venueMoney(venue.currency, venue.base_price)}
                    <span className="text-xs font-normal text-white/70">
                      {" "}
                      {priceUnitLabel(venue.price_unit)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="font-heading text-lg font-bold text-white">Price on request</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail strip, same treatment as the Umrah package detail page. */}
      {gallery.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {gallery.slice(1, 7).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" decoding="async" className="h-16 w-full rounded-lg object-cover sm:h-20" />
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* Key facts — one ruled rail instead of three icon-tile cards. */}
          {(() => {
            const facts = [
              venue.capacity_seated ? { label: "Seated", value: `${venue.capacity_seated} guests` } : null,
              venue.capacity_standing ? { label: "Standing", value: `${venue.capacity_standing} guests` } : null,
              venue.size_sqm ? { label: "Hall size", value: `${Number(venue.size_sqm).toFixed(0)} m²` } : null,
            ].filter((f): f is { label: string; value: string } => f !== null);
            return facts.length > 0 ? (
              <dl
                className="grid divide-x divide-border rounded-xl border border-border bg-secondary/40"
                style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
              >
                {facts.map((fact) => (
                  <div key={fact.label} className="px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                    <dd className="mt-0.5 text-sm font-bold tabular-nums sm:text-base">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null;
          })()}

          {/* About */}
          <section>
            <h2 className="font-heading text-xl font-bold">About this venue</h2>
            {venue.tagline ? (
              <p className="mt-1 text-sm font-medium text-primary">{venue.tagline}</p>
            ) : null}
            {venue.description ? (
              <p className="mt-2 leading-relaxed text-muted-foreground">{venue.description}</p>
            ) : null}
            <PropertyLinks links={venue.property_links} className="mt-3" />
          </section>

          {/* Perfect for */}
          {eventTypes.length > 0 ? (
            <section>
              <h2 className="font-heading text-xl font-bold">Event types</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {eventTypes.map((t) => (
                  <Badge
                    key={t}
                    className="border-transparent bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
                  >
                    {eventTypeLabel(t)}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {/* Amenities */}
          {amenities.length > 0 ? (
            <section>
              <h2 className="font-heading text-xl font-bold">Amenities &amp; services</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {amenities.map((key) => {
                  const { icon: Icon, label } = amenityInfo(key);
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm text-foreground">
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {venue.policies ? (
            <section>
              <h2 className="font-heading text-xl font-bold">Policies</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-wrap text-muted-foreground">{venue.policies}</p>
            </section>
          ) : null}

          <PropertyReviews reviews={venue.property_reviews} />
        </div>

        {/* Booking card */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="text-base">Reserve this venue</CardTitle>
            </CardHeader>
            <CardContent>
              <HallBookingForm
                venueId={venue.id}
                currency={venue.currency}
                basePrice={Number(venue.base_price)}
                priceUnit={venue.price_unit}
                eventTypes={eventTypes}
                maxGuests={venueCapacity(venue)}
                bookedForSlot={<AgencyBookingSlot />}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
