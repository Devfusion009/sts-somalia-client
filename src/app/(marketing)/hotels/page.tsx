import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, Headset, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { searchHotels } from "@/modules/hotels/queries";
import { HotelCard } from "@/modules/hotels/components/hotel-card";
import { HotelSearchFilters } from "./hotel-search-filters";

export const metadata: Metadata = { title: "Hotels" };

const TRUST_POINTS = [
  { icon: BadgeCheck, text: "Verified local & international properties" },
  { icon: ShieldCheck, text: "Secure payment — card, mobile money, or bank" },
  { icon: Headset, text: "24/7 support before, during, and after your stay" },
];

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { city = "", checkIn = "", checkOut = "", guests = "" } = await searchParams;
  const hotels = await searchHotels({ city: city || undefined });

  const bookingQuery = new URLSearchParams();
  if (checkIn) bookingQuery.set("checkIn", checkIn);
  if (checkOut) bookingQuery.set("checkOut", checkOut);
  if (guests) bookingQuery.set("guests", guests);
  const bookingSuffix = bookingQuery.toString() ? `?${bookingQuery.toString()}` : "";

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-sidebar via-sidebar to-primary/40 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Hotel Booking
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Find your perfect stay, <span className="text-brand-accent">at the best rates</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-sidebar-foreground/80">
              From seafront hotels in Mogadishu to business stays across East Africa and the Gulf —
              book with confidence through STS.
            </p>
          </div>
          <div className="mt-7 max-w-4xl">
            <HotelSearchFilters initial={{ city, checkIn, checkOut, guests }} />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                <point.icon className="size-4 text-primary" /> {point.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-xl font-bold">
            {city ? `Hotels in "${city}"` : "All hotels"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hotels.length} propert{hotels.length === 1 ? "y" : "ies"}
          </p>
        </div>

        {hotels.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <div key={hotel.id} className="h-full">
                {/* Date/guest selections ride along to the detail page */}
                <HotelCardWithQuery hotel={hotel} suffix={bookingSuffix} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Building2 className="size-5" />
            </span>
            <p className="text-lg font-medium">No hotels found</p>
            <p className="text-sm text-muted-foreground">
              Try a different city, or{" "}
              <Link href="/hotels" className="text-primary hover:underline">
                browse all hotels
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HotelCardWithQuery({
  hotel,
  suffix,
}: {
  hotel: Parameters<typeof HotelCard>[0]["hotel"];
  suffix: string;
}) {
  if (!suffix) return <HotelCard hotel={hotel} />;
  return <HotelCard hotel={{ ...hotel, slug: `${hotel.slug}${suffix}` }} />;
}
