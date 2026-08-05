import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BedDouble,
  Bus,
  CalendarDays,
  ChevronRight,
  Clock3,
  Headset,
  Home,
  Landmark,
  MapPin,
  Plane,
  Stamp,
  UserCheck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { getPackageBySlug } from "@/modules/umrah/queries";
import { packageTier } from "@/modules/umrah/components/package-card";
import { cn } from "@/lib/utils";
import { BookingForm } from "./booking-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  return { title: pkg?.name ?? "Umrah Package" };
}

const INCLUDE_DETAILS: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  flights: { label: "Return Flights", description: "From Mogadishu or Hargeisa", icon: Plane },
  visa: { label: "Umrah Visa", description: "Processing handled by STS", icon: Stamp },
  hotel: { label: "Hotel Accommodation", description: "In Makkah & Madinah", icon: BedDouble },
  transport: { label: "Ground Transport", description: "Airport & inter-city transfers", icon: Bus },
  meals: { label: "Meals", description: "Daily breakfast & dinner", icon: UtensilsCrossed },
  ziyarat_tours: { label: "Guided Ziyarat", description: "Historic sites with a guide", icon: MapPin },
  private_guide: { label: "Private Guide", description: "Dedicated personal guide", icon: UserCheck },
};

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
        <span className="font-medium text-foreground">{pkg.name}</span>
      </nav>

      <div className="relative overflow-hidden rounded-2xl">
        <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-56 w-full sm:h-72" />
        <Badge
          className={cn("absolute top-4 left-4 border-transparent bg-card font-semibold", tier.className)}
        >
          {tier.label} Package
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{pkg.name}</h1>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="size-4" /> {pkg.duration_days} days
        </span>
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

      {pkg.description ? (
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{pkg.description}</p>
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
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs lg:sticky lg:top-24">
            <p className="text-sm text-muted-foreground">Starting from</p>
            <p className="font-heading text-3xl font-bold text-primary">
              {pkg.currency} {pkg.base_price.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground"> / pilgrim</span>
            </p>
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
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Select a departure and enter pilgrim details below — payment is the final step, and
              our team confirms passport &amp; visa requirements with you personally.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/50 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Headset className="size-4 text-primary" /> Questions about this package?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Talk to our Umrah specialists — we&apos;ll help you pick dates and answer visa
              questions.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              render={<a href="tel:+252611444420" />}
            >
              Call +252 611 444 420
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
