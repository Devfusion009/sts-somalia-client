import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeHero } from "@/components/marketing/home-hero";
import { ValueProps } from "@/components/marketing/value-props";
import { PartnerCta } from "@/components/marketing/partner-cta";
import { HotelCard } from "@/modules/hotels/components/hotel-card";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getFeaturedHotels } from "@/modules/hotels/queries";
import { getFeaturedPackages } from "@/modules/umrah/queries";

export default async function HomePage() {
  const [hotels, packages] = await Promise.all([getFeaturedHotels(), getFeaturedPackages()]);

  return (
    <>
      <HomeHero />
      <ValueProps />

      {hotels.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Featured hotels</h2>
            <Link href="/hotels" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {hotels.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </section>
      ) : null}

      {packages.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Upcoming Umrah packages</h2>
            <Link href="/umrah" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      ) : null}

      <PartnerCta />
    </>
  );
}
