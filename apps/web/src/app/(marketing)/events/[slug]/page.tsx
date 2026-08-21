import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Home, Landmark, MapPin, Phone, Ruler, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { PropertyLinks } from "@/components/property-links";
import { PropertyReviews } from "@/components/property-reviews";
import { venueImageUrls } from "@/modules/events/images";
import { getVenueBySlug } from "@/modules/events/queries";
import {
  amenityInfo,
  eventTypeLabel,
  priceUnitLabel,
} from "@/modules/events/components/amenities";
import { HallBookingForm } from "@/modules/events/components/booking-form";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  return { title: venue?.name ?? "Venue" };
}

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  const amenities = Array.isArray(venue.amenities) ? (venue.amenities as string[]) : [];
  const gallery = venueImageUrls(venue.images);
  const eventTypes = Array.isArray(venue.event_types) ? (venue.event_types as string[]) : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/events" className="hover:text-foreground">
          Events &amp; Halls
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{venue.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl">
        {gallery[0] ? (
          // Either a repo asset or a Storage URL — see the note on the venue
          // card; next/image would need the Supabase host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery[0]} alt={venue.name} className="h-56 w-full object-cover sm:h-72" />
        ) : (
          <MediaPlaceholder seed={venue.slug} icon={Landmark} className="h-56 w-full sm:h-72" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute right-0 bottom-0 left-0 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {venue.is_featured ? (
                <Badge className="mb-2 border-transparent bg-brand-accent text-brand-accent-foreground">
                  Featured Venue
                </Badge>
              ) : null}
              <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">
                {venue.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <MapPin className="size-4" />
                {venue.address ? `${venue.address}, ` : ""}
                {venue.city}
              </p>
              {venue.phone ? (
                <a
                  href={`tel:${venue.phone}`}
                  className="mt-1 inline-flex items-center gap-1 text-sm text-white/85 hover:text-white"
                >
                  <Phone className="size-3.5" /> {venue.phone}
                </a>
              ) : null}
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-right backdrop-blur">
              {Number(venue.base_price) > 0 ? (
                <>
                  <p className="text-[10px] text-white/70 uppercase">From</p>
                  <p className="font-heading text-xl font-bold text-white">
                    {venue.currency} {Number(venue.base_price).toFixed(0)}
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
            <img key={src} src={src} alt="" className="h-16 w-full rounded-lg object-cover sm:h-20" />
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* Key facts */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              venue.capacity_seated
                ? { icon: Users, label: "Seated Capacity", value: `${venue.capacity_seated} guests` }
                : null,
              venue.capacity_standing
                ? { icon: Users, label: "Standing Capacity", value: `${venue.capacity_standing} guests` }
                : null,
              venue.size_sqm
                ? { icon: Ruler, label: "Hall Size", value: `${Number(venue.size_sqm).toFixed(0)} m²` }
                : null,
            ]
              .filter((f): f is { icon: typeof Users; label: string; value: string } => f !== null)
              .map((fact) => (
                <div key={fact.label} className="rounded-xl border border-border bg-card p-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
                    <fact.icon className="size-4" />
                  </span>
                  <p className="mt-2 text-xs text-muted-foreground">{fact.label}</p>
                  <p className="text-sm font-bold">{fact.value}</p>
                </div>
              ))}
          </div>

          {/* About */}
          <section>
            <h2 className="font-heading text-xl font-bold">About this venue</h2>
            {venue.tagline ? (
              <p className="mt-1 text-sm font-medium text-primary">{venue.tagline}</p>
            ) : null}
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {venue.description ?? "Contact our events team for full details about this venue."}
            </p>
            <PropertyLinks links={venue.property_links} className="mt-3" />
          </section>

          {/* Perfect for */}
          {eventTypes.length > 0 ? (
            <section>
              <h2 className="font-heading text-xl font-bold">Perfect for</h2>
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
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {amenities.map((key) => {
                  const { icon: Icon, label } = amenityInfo(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <PropertyReviews reviews={venue.property_reviews} />
        </div>

        {/* Booking card */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-base">Reserve this venue</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tell us about your event — pay securely online and our team takes it from there.
              </p>
            </CardHeader>
            <CardContent>
              <HallBookingForm
                venueId={venue.id}
                currency={venue.currency}
                basePrice={Number(venue.base_price)}
                priceUnit={venue.price_unit}
                eventTypes={eventTypes}
                maxGuests={venue.capacity_standing ?? venue.capacity_seated}
                bookedForSlot={<AgencyBookingSlot />}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
