import { requireUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BedDouble,
  CalendarDays,
  Clock3,
  Landmark,
  MapPin,
  Plane,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { dateSpan, shortDate } from "@/lib/money";
import { bookableDepartures, getPackageBySlug } from "@/modules/umrah/queries";
import { packageTier, discountPercent } from "@/modules/umrah/components/package-card";
import { umrahImageUrls, MEAL_PLAN_LABELS, sharingLabel } from "@/modules/umrah/images";
import { INCLUDE_DETAILS } from "@/modules/umrah/includes";
import { BookingForm } from "./booking-form";
import { FlightDetails, hasFlightDetails } from "./flight-details";
import { AgencyBookingSlot, viewerAgencyId } from "@/modules/agencies/components/agency-booking-slot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  await requireUser(`/umrah/${slug}`);
  const pkg = await getPackageBySlug(slug);
  return { title: pkg?.name ?? "Umrah Package" };
}

export default async function UmrahPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pkg, viewerAgency] = await Promise.all([getPackageBySlug(slug), viewerAgencyId()]);
  if (!pkg) notFound();

  const upcomingDepartures = bookableDepartures(pkg.umrah_package_departures ?? []);

  const includes: string[] = Array.isArray(pkg.includes) ? (pkg.includes as string[]) : [];
  const tier = packageTier(pkg);
  const gallery = umrahImageUrls(pkg.images);
  const discount = discountPercent(pkg.base_price, pkg.original_price === null ? null : Number(pkg.original_price));
  const hotels = [...(pkg.umrah_package_hotels ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const itinerary = [...(pkg.umrah_itinerary_days ?? [])].sort((a, b) => a.day_number - b.day_number);
  const rateCard = [...(pkg.umrah_package_pricing ?? [])].sort((a, b) => a.sharing - b.sharing);
  const departuresWithFlights = upcomingDepartures.filter(hasFlightDetails);
  const fromPrice =
    rateCard.length > 0 ? Math.min(...rateCard.map((rate) => Number(rate.price))) : Number(pkg.base_price);
  const CITY_LABELS: Record<string, string> = { makkah: "Makkah", madinah: "Madinah", other: "Stay" };

  const priceLabel = (n: number) => `${pkg.currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const sectionTitle = "font-heading text-xl font-bold tracking-tight sm:text-2xl";
  const contactPhone = pkg.contact_person_phone ?? "+252 611 444 420";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb
        className="mb-4"
        items={[
          { label: "Umrah", href: "/umrah" },
          { label: "Group", href: "/umrah/group" },
          { label: pkg.name },
        ]}
      />

      <div className="relative overflow-hidden rounded-2xl">
        {gallery[0] ? (
          // Supabase Storage URL, not a local asset — next/image would need the
          // remote host allow-listed in next.config.ts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gallery[0]}
            alt={pkg.name}
            fetchPriority="high"
            className="h-56 w-full object-cover sm:h-80"
          />
        ) : (
          <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-56 w-full sm:h-80" />
        )}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {pkg.is_featured ? (
            <Badge className="border-transparent bg-brand-accent font-semibold text-brand-accent-foreground">
              Featured
            </Badge>
          ) : null}
          <Badge className="border-transparent bg-card font-semibold text-foreground">
            {tier.label} package
          </Badge>
          <Badge className="border-transparent bg-card font-semibold text-primary">Group · fixed price</Badge>
        </div>
      </div>

      {gallery.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {gallery.slice(1, 7).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" className="h-16 w-full rounded-lg object-cover sm:h-20" />
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-12">
          <header>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">{pkg.name}</h1>
            {pkg.tagline ? <p className="mt-1.5 text-lg text-muted-foreground">{pkg.tagline}</p> : null}
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5 tabular-nums">
                <Clock3 className="size-4" aria-hidden /> {pkg.duration_days}D /{" "}
                {Math.max(0, pkg.duration_days - 1)}N
              </li>
              {pkg.origin_iata && pkg.destination_iata ? (
                <li className="flex items-center gap-1.5 font-semibold text-foreground">
                  {pkg.origin_iata}
                  <Plane className="size-3.5 text-muted-foreground" aria-label="to" />
                  {pkg.destination_iata}
                </li>
              ) : null}
              {upcomingDepartures[0] ? (
                <li className="flex items-center gap-1.5 tabular-nums">
                  <CalendarDays className="size-4" aria-hidden />
                  Next departure {shortDate(upcomingDepartures[0].departure_date)}
                </li>
              ) : null}
            </ul>
            {pkg.description ? (
              <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{pkg.description}</p>
            ) : null}

            {/* Phones: the price summary lives in the sidebar, which only
                appears after every section below. */}
            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-secondary/40 p-4 lg:hidden">
              <p className="min-w-0">
                <span className="block text-xs text-muted-foreground">From</span>
                <span className="font-heading text-xl font-bold text-primary tabular-nums">
                  {priceLabel(fromPrice)}
                </span>
                <span className="text-xs text-muted-foreground"> / pilgrim</span>
              </p>
              <Button render={<a href="#book" />} size="lg" className="shrink-0">
                Book now
              </Button>
            </div>
          </header>

          {hotels.length > 0 ? (
            <section aria-labelledby="pkg-hotels">
              <h2 id="pkg-hotels" className={sectionTitle}>
                Where you&apos;ll stay
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {hotels.map((h) => (
                  <div key={h.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {CITY_LABELS[h.city] ?? h.city} hotel
                    </p>
                    <p className="mt-0.5 font-heading text-base font-bold">
                      {h.name}
                      {h.star_rating ? (
                        <span className="ml-1.5 text-brand-gold" aria-label={`${h.star_rating}-star`}>
                          {"★".repeat(h.star_rating)}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                      {h.distance_to_haram_m ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden /> {h.distance_to_haram_m}m from the Haram
                        </span>
                      ) : null}
                      {h.nights ? (
                        <span className="flex items-center gap-1">
                          <BedDouble className="size-3" aria-hidden /> {h.nights} night{h.nights === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {h.room_type ? <span>{h.room_type}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {pkg.meal_plan !== "none" || pkg.meals_note ? (
            <section aria-labelledby="pkg-food">
              <h2 id="pkg-food" className={sectionTitle}>
                Food
              </h2>
              <div className="mt-4 flex items-start gap-3">
                <UtensilsCrossed className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold">{MEAL_PLAN_LABELS[pkg.meal_plan] ?? pkg.meal_plan}</p>
                  {pkg.meals_note ? <p className="mt-0.5 text-sm text-muted-foreground">{pkg.meals_note}</p> : null}
                </div>
              </div>
            </section>
          ) : null}

          {itinerary.length > 0 ? (
            <section aria-labelledby="pkg-itinerary">
              <h2 id="pkg-itinerary" className={sectionTitle}>
                Day-by-day plan
              </h2>
              <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
                {itinerary.map((day) => (
                  <li key={day.id} className="flex gap-4 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                      <span className="sr-only">Day </span>
                      {day.day_number}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-base font-semibold">{day.title}</h3>
                      {day.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{day.description}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {rateCard.length > 0 ? (
            <section aria-labelledby="pkg-rates">
              <h2 id="pkg-rates" className={sectionTitle}>
                Price per pilgrim
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {rateCard.map((rate) => (
                  <div key={rate.id} className="rounded-xl border border-border bg-card p-4">
                    <dt className="text-xs text-muted-foreground">{sharingLabel(rate.sharing)}</dt>
                    <dd className="mt-1 font-heading text-lg font-bold text-primary tabular-nums">
                      {priceLabel(Number(rate.price))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {departuresWithFlights.length > 0 ? (
            <section aria-labelledby="pkg-flights">
              <h2 id="pkg-flights" className={sectionTitle}>
                Flights
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {departuresWithFlights.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                      <CalendarDays className="size-4 text-primary" aria-hidden />
                      {dateSpan(d.departure_date, d.return_date)}
                    </h3>
                    <FlightDetails departure={d} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {includes.length > 0 ? (
            <section aria-labelledby="pkg-includes">
              <h2 id="pkg-includes" className={sectionTitle}>
                What&apos;s included
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                {includes.map((item) => {
                  const detail = INCLUDE_DETAILS[item];
                  if (!detail) return null;
                  return (
                    <li key={item} className="flex items-start gap-3">
                      <detail.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold">{detail.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{detail.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section
            id="book"
            aria-label="Book this package"
            className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7"
          >
            <BookingForm
              packageSlug={pkg.slug}
              currency={pkg.currency}
              basePrice={pkg.base_price}
              departures={upcomingDepartures}
              pricing={rateCard}
              bookedForSlot={viewerAgency ? <AgencyBookingSlot /> : null}
            />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">Fixed price, from</p>
            <p className="font-heading text-3xl font-bold text-primary tabular-nums">
              {priceLabel(fromPrice)}
              <span className="text-sm font-normal text-muted-foreground"> / pilgrim</span>
            </p>
            {discount ? (
              <p className="mt-1 text-sm tabular-nums">
                <span className="text-muted-foreground line-through">
                  {priceLabel(Number(pkg.original_price))}
                </span>{" "}
                <span className="font-semibold text-primary">{discount}% off</span>
              </p>
            ) : null}
            <Separator className="my-4" />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold tabular-nums">{pkg.duration_days} days</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Upcoming departures</dt>
                <dd className="font-semibold tabular-nums">{upcomingDepartures.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Package tier</dt>
                <dd className="font-semibold">{tier.label}</dd>
              </div>
            </dl>
            <Button render={<a href="#book" />} size="lg" className="mt-5 hidden w-full lg:inline-flex">
              Book now
            </Button>
          </div>

          <div className="rounded-2xl bg-secondary/50 p-5">
            <h2 className="text-sm font-semibold">Questions about this package?</h2>
            {pkg.contact_person_name ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{pkg.contact_person_name}</span> looks after this
                package.
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="lg"
                className="w-full bg-card tabular-nums"
                render={<a href={`tel:${contactPhone.replace(/\s/g, "")}`} />}
              >
                Call {contactPhone}
              </Button>
              {pkg.contact_whatsapp ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full bg-card"
                  render={
                    <a
                      href={`https://wa.me/${pkg.contact_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hello STS! I have a question about the ${pkg.name} package.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  WhatsApp
                </Button>
              ) : null}
              {pkg.contact_person_email ? (
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full truncate"
                  render={<a href={`mailto:${pkg.contact_person_email}`} />}
                >
                  {pkg.contact_person_email}
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
