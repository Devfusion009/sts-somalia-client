import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  Clock3,
  Headset,
  Home,
  Landmark,
  MapPin,
  Plane,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { getPackageBySlug } from "@/modules/umrah/queries";
import { packageTier, discountPercent } from "@/modules/umrah/components/package-card";
import { umrahImageUrls, MEAL_PLAN_LABELS, sharingLabel } from "@/modules/umrah/images";
import { INCLUDE_DETAILS } from "@/modules/umrah/includes";
import { cn } from "@/lib/utils";
import { BookingForm } from "./booking-form";
import { FlightDetails, hasFlightDetails } from "./flight-details";
import { AgencyBookingSlot } from "@/modules/agencies/components/agency-booking-slot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  return { title: pkg?.name ?? "Umrah Package" };
}

export default async function UmrahPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) notFound();

  const today = new Date(new Date().toDateString());
  const upcomingDepartures = (pkg.umrah_package_departures ?? [])
    .filter((d) => new Date(d.departure_date) >= today)
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date));

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/umrah" className="hover:text-foreground">
          Umrah
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/umrah/group" className="hover:text-foreground">
          Group
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{pkg.name}</span>
      </nav>

      <div className="relative overflow-hidden rounded-2xl">
        {gallery[0] ? (
          // Supabase Storage URL, not a local asset — next/image would need the
          // remote host allow-listed in next.config.ts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery[0]} alt={pkg.name} className="h-56 w-full object-cover sm:h-72" />
        ) : (
          <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-56 w-full sm:h-72" />
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          {pkg.is_featured ? (
            <Badge className="border-transparent bg-brand-accent font-semibold text-brand-accent-foreground">
              Most Popular
            </Badge>
          ) : null}
          <Badge className={cn("border-transparent bg-card font-semibold", tier.className)}>
            {tier.label} Package
          </Badge>
          <Badge className="border-transparent bg-card font-semibold text-primary">
            Group · fixed price
          </Badge>
        </div>
      </div>

      {gallery.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {gallery.slice(1, 7).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-16 w-full rounded-lg object-cover sm:h-20" />
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{pkg.name}</h1>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="size-4" /> {pkg.duration_days}D / {Math.max(0, pkg.duration_days - 1)}N
        </span>
        {pkg.origin_iata && pkg.destination_iata ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {pkg.origin_iata} <Plane className="size-3.5 text-muted-foreground" /> {pkg.destination_iata}
          </span>
        ) : null}
        {upcomingDepartures[0] ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            Next departure{" "}
            {new Date(upcomingDepartures[0].departure_date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : null}
      </div>

      {pkg.tagline ? <p className="mt-1 text-lg text-muted-foreground">{pkg.tagline}</p> : null}

      {pkg.description ? (
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{pkg.description}</p>
      ) : null}

      {hotels.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Where you&apos;ll stay</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hotels.map((h) => (
              <div key={h.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {CITY_LABELS[h.city] ?? h.city} Hotel
                </p>
                <p className="mt-0.5 font-heading text-base font-bold">
                  {h.name}
                  {h.star_rating ? <span className="ml-1.5 text-brand-gold">{"★".repeat(h.star_rating)}</span> : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {h.distance_to_haram_m ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" /> {h.distance_to_haram_m}m from Haram
                    </span>
                  ) : null}
                  {h.nights ? (
                    <span className="flex items-center gap-1">
                      <BedDouble className="size-3" /> {h.nights} night{h.nights === 1 ? "" : "s"}
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
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Food</h2>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <UtensilsCrossed className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold">{MEAL_PLAN_LABELS[pkg.meal_plan] ?? pkg.meal_plan}</p>
              {pkg.meals_note ? <p className="text-xs text-muted-foreground">{pkg.meals_note}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {itinerary.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Day-by-day plan</h2>
          <ol className="mt-4 space-y-3">
            {itinerary.map((day) => (
              <li key={day.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {day.day_number}
                </span>
                <div>
                  <p className="font-heading text-base font-semibold">{day.title}</p>
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
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Price per pilgrim</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rateCard.map((rate) => (
              <div key={rate.id} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs text-muted-foreground">{sharingLabel(rate.sharing)}</p>
                <p className="mt-1 font-heading text-lg font-bold text-primary">
                  {pkg.currency} {Number(rate.price).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {departuresWithFlights.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Flights</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {departuresWithFlights.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                  <CalendarDays className="size-4 text-primary" />
                  {new Date(d.departure_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  –{" "}
                  {new Date(d.return_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <FlightDetails departure={d} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {includes.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">What&apos;s included</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {includes.map((item) => {
              const detail = INCLUDE_DETAILS[item];
              if (!detail) return null;
              return (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <detail.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{detail.label}</p>
                    <p className="text-xs text-muted-foreground">{detail.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          <BookingForm
            packageSlug={pkg.slug}
            currency={pkg.currency}
            basePrice={pkg.base_price}
            departures={upcomingDepartures}
            pricing={rateCard}
            bookedForSlot={<AgencyBookingSlot />}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs lg:sticky lg:top-24">
            <p className="text-sm text-muted-foreground">Fixed price, from</p>
            <p className="font-heading text-3xl font-bold text-primary">
              {pkg.currency} {fromPrice.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground"> / pilgrim</span>
            </p>
            {discount ? (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground line-through">
                  {pkg.currency} {Number(pkg.original_price).toFixed(0)}
                </span>{" "}
                <span className="font-semibold text-primary">{discount}% OFF</span>
              </p>
            ) : null}
            <Separator className="my-4" />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold">{pkg.duration_days} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Upcoming departures</dt>
                <dd className="font-semibold">{upcomingDepartures.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Package tier</dt>
                <dd className="font-semibold">{tier.label}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/50 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Headset className="size-4 text-primary" /> Questions about this package?
            </p>
            {pkg.contact_person_name ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{pkg.contact_person_name}</span> looks after this
                package and can help with dates, visas, and paperwork.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Talk to our Umrah specialists — we&apos;ll help you pick dates and answer visa questions.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              render={<a href={`tel:${(pkg.contact_person_phone ?? "+252611444420").replace(/\s/g, "")}`} />}
            >
              Call {pkg.contact_person_phone ?? "+252 611 444 420"}
            </Button>
            {pkg.contact_whatsapp ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
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
                size="sm"
                className="mt-2 w-full"
                render={<a href={`mailto:${pkg.contact_person_email}`} />}
              >
                {pkg.contact_person_email}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
