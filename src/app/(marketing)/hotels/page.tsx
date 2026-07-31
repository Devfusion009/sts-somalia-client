import type { Metadata } from "next";
import Link from "next/link";
import { searchHotels } from "@/lib/data/hotels";
import { HotelCard } from "@/components/hotels/hotel-card";
import { HotelSearchFilters } from "./hotel-search-filters";

export const metadata: Metadata = { title: "Hotels" };

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city = "" } = await searchParams;
  const hotels = await searchHotels({ city: city || undefined });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-semibold">Hotels</h1>
      <p className="mt-1 text-muted-foreground">
        Find a place to stay across Somalia and beyond.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <HotelSearchFilters initialCity={city} />
      </div>

      {hotels.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
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
  );
}
