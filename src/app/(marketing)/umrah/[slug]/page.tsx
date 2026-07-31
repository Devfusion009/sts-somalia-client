import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { getPackageBySlug } from "@/lib/data/umrah";
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

const INCLUDE_LABELS: Record<string, string> = {
  flights: "Return flights",
  visa: "Umrah visa processing",
  hotel: "Hotel accommodation",
  transport: "Ground transport",
  meals: "Meals",
  ziyarat_tours: "Guided ziyarat tours",
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <MediaPlaceholder seed={pkg.id} icon={Landmark} className="h-56 w-full rounded-2xl sm:h-72" />

      <div className="mt-6 flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{pkg.name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {pkg.duration_days} days
        </p>
      </div>

      {includes.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {includes.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" />
              {INCLUDE_LABELS[item] ?? item}
            </Badge>
          ))}
        </div>
      ) : null}

      {pkg.description ? <p className="mt-6 max-w-3xl text-muted-foreground">{pkg.description}</p> : null}

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BookingForm
            packageSlug={pkg.slug}
            currency={pkg.currency}
            basePrice={pkg.base_price}
            departures={upcomingDepartures}
          />
        </div>
        <aside className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Starting from</p>
            <p className="font-heading text-3xl font-semibold text-foreground">
              {pkg.currency} {pkg.base_price.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground"> / person</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Select a departure date and enter pilgrim details to book. Our team will
              follow up to confirm passport and visa requirements.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
