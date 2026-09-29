import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { HotelCard } from "@/modules/hotels/components/hotel-card";
import { getFeaturedHotels } from "@/modules/hotels/queries";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * With no published hotels yet (fresh database), the band must not vanish —
 * it falls back to curated destination cards that link into hotel search.
 */
const FALLBACK_DESTINATIONS = [
  { city: "Mogadishu", blurb: "Seafront stays and business hotels in the capital.", image: "/marketing/beach.webp" },
  { city: "Hargeisa", blurb: "Comfortable, well-located hotels in Somaliland's hub.", image: "/marketing/kenya.webp" },
  { city: "Nairobi", blurb: "City hotels for stopovers, medical trips and business.", image: "/marketing/hotel.webp" },
  { city: "Dubai", blurb: "From budget rooms near the Creek to five-star towers.", image: "/marketing/dubai.webp" },
];

function Heading() {
  return (
    <SectionHeading
      align="left"
      title="Featured hotels"
      lead="Hand-checked properties with confirmed rates and real photos."
      action={
        <Link
          href="/hotels"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          View all hotels <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    />
  );
}

export async function FeaturedHotels() {
  const hotels = await getFeaturedHotels();

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {hotels.length > 0
            ? hotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} />)
            : FALLBACK_DESTINATIONS.map((destination) => (
                <Link
                  key={destination.city}
                  href={`/hotels?city=${encodeURIComponent(destination.city)}`}
                  className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-2xl border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Image
                    src={destination.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" aria-hidden />
                  <div className="relative p-5 text-white">
                    <h3 className="font-heading text-lg font-semibold">{destination.city}</h3>
                    <p className="mt-1 text-xs text-white/80">{destination.blurb}</p>
                    <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-200">
                      Browse hotels
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedHotelsSkeleton() {
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
