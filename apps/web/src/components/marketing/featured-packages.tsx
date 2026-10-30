import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getFeaturedPackages } from "@/modules/umrah/queries";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Empty-database fallback: static package teasers so the band never
 * disappears before real packages are published.
 */
const FALLBACK_TEASERS = [
  {
    name: "Economy Umrah",
    image: "/marketing/umrah-tiers/economy-v1.webp",
    imageAlt: "Illustration of the Prophet’s Mosque courtyard in Madinah",
    blurb: "Flights, shared rooms near the Haram, visa and ground transport.",
    badge: null,
  },
  {
    name: "Standard Umrah",
    image: "/marketing/umrah-tiers/standard-v1.webp",
    imageAlt: "Illustration of the Grand Mosque in Makkah at twilight",
    blurb: "Closer hotels, guided ziyarah in Makkah and Madinah, and meals arranged for the group.",
    badge: "Popular",
  },
  {
    name: "VIP Umrah",
    image: "/marketing/umrah-tiers/vip-v1.webp",
    imageAlt: "Illustrative lounge overlooking Makkah at sunset",
    blurb: "Five-star hotels steps from the Haram, private transfers and a dedicated guide throughout.",
    badge: null,
  },
];

function Heading() {
  return (
    <SectionHeading
      align="left"
      title="Upcoming Umrah packages"
      lead="Flights, hotels, visa and a guide — one price per pilgrim."
      action={
        <Link
          href="/umrah/group"
          className="flex h-11 items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          View all packages <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    />
  );
}

export async function FeaturedPackages() {
  const packages = await getFeaturedPackages();

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading />
        <div
          className={
            packages.length > 0
              ? "mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
              : "mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3"
          }
        >
          {packages.length > 0
            ? packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)
            : FALLBACK_TEASERS.map((teaser) => (
                <Link
                  key={teaser.name}
                  href="/umrah/group"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <Image
                      src={teaser.image}
                      alt={teaser.imageAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
                    {teaser.badge ? (
                      <Badge className="absolute top-3 left-3 border-transparent bg-brand-accent font-semibold text-brand-accent-foreground">
                        {teaser.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="font-heading text-lg font-semibold group-hover:text-primary">
                      {teaser.name}
                    </h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{teaser.blurb}</p>
                    <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                      Ask about dates
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedPackagesSkeleton() {
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
