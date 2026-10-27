import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { BadgeCheck, Building2, Headset, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { searchHotels } from "@/modules/hotels/queries";
import { HotelListRow } from "@/modules/hotels/components/hotel-list-row";
import { amenityLabel } from "@/modules/hotels/images";
import { HotelSearchFilters } from "./hotel-search-filters";
import { HotelFilters, HotelFiltersSheet } from "./hotel-filters";
import { priceBandOf } from "@/modules/hotels/price-bands";
import { HotelRail, type RailProperty } from "@/components/marketing/hotel-rail";
import { HotelsFaq, GuestVoices, ExploreMore, HOTEL_FAQS } from "@/components/marketing/hotels-extras";
import { jsonLdScript } from "@/lib/json-ld";
import type { HotelCardData } from "@/modules/hotels/components/hotel-card";

export const metadata: Metadata = { title: "Hotels" };

const faqJsonLd = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

const TRUST_POINTS = [
  { icon: BadgeCheck, text: "Verified local & international properties" },
  { icon: ShieldCheck, text: "Secure payment — card, mobile money, or bank" },
  { icon: Headset, text: "Support in Somali, English and Arabic" },
];

/* Curated rails shown alongside real inventory. Prices are PLACEHOLDERS for
   layout — swap for live partner rates before launch. */
const CENTRAL_STAYS: RailProperty[] = [
  { name: "Seafront business hotel", image: "/marketing/hotel-exterior.webp", location: "Mogadishu", stars: 4, price: "$95", href: "/hotels?city=Mogadishu" },
  { name: "City-centre suite hotel", image: "/marketing/hotel-suite.webp", location: "Mogadishu", stars: 5, price: "$140", href: "/hotels?city=Mogadishu" },
  { name: "Airport transit hotel", image: "/marketing/hotel-reception.webp", location: "Mogadishu", stars: 3, price: "$62", href: "/hotels?city=Mogadishu" },
  { name: "Downtown guesthouse", image: "/marketing/hotel-budget.webp", location: "Hargeisa", stars: 2, price: "$38", href: "/hotels?city=Hargeisa" },
  { name: "Corporate stay", image: "/marketing/hotel-business.webp", location: "Nairobi", stars: 4, price: "$78", href: "/hotels?city=Nairobi" },
];

const LEISURE_STAYS: RailProperty[] = [
  { name: "Rooftop pool resort", image: "/marketing/hotel-pool.webp", location: "Dubai", stars: 5, price: "$155", href: "/hotels?city=Dubai" },
  { name: "Seafront terrace hotel", image: "/marketing/hotel-terrace.webp", location: "Mogadishu", stars: 4, price: "$105", href: "/hotels?city=Mogadishu" },
  { name: "Grand lobby hotel", image: "/marketing/hotel-lobby.webp", location: "Istanbul", stars: 5, price: "$120", href: "/hotels?city=Istanbul" },
  { name: "Breakfast-included stay", image: "/marketing/hotel-breakfast.webp", location: "Addis Ababa", stars: 4, price: "$70", href: "/hotels?city=Addis%20Ababa" },
  { name: "Family rooms available", image: "/marketing/hotel-family.webp", location: "Jeddah", stars: 4, price: "$88", href: "/hotels?city=Jeddah" },
];

/** Parse a comma-separated multi-select param. */
const list = (v?: string) => (v ?? "").split(",").filter(Boolean);


export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    occ?: string;
    stars?: string;
    price?: string;
    amenities?: string;
  }>;
}) {
  const {
    city = "",
    checkIn = "",
    checkOut = "",
    guests = "",
    occ = "",
    stars = "",
    price = "",
    amenities = "",
  } = await searchParams;

  const all = await searchHotels({
    city: city || undefined,
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
    adults: guests ? Number(guests) : undefined,
  });

  // Facet counts come from the unfiltered result set so a filter never shows
  // "(0)" for something that would match once you deselect a sibling.
  const starCounts: Record<string, number> = {};
  const priceCounts: Record<string, number> = {};
  const amenityCounts = new Map<string, number>();
  for (const h of all) {
    if (h.star_rating) starCounts[String(h.star_rating)] = (starCounts[String(h.star_rating)] ?? 0) + 1;
    const band = priceBandOf(h.minPrice);
    if (band) priceCounts[band] = (priceCounts[band] ?? 0) + 1;
    for (const a of h.amenities) amenityCounts.set(a, (amenityCounts.get(a) ?? 0) + 1);
  }

  const selectedStars = list(stars);
  const selectedPrice = list(price);
  const selectedAmenities = list(amenities);

  const hotels = all.filter((h: HotelCardData) => {
    if (selectedStars.length && !selectedStars.includes(String(h.star_rating ?? ""))) return false;
    if (selectedPrice.length) {
      const band = priceBandOf(h.minPrice);
      if (!band || !selectedPrice.includes(band)) return false;
    }
    if (selectedAmenities.length && !selectedAmenities.every((a) => h.amenities.includes(a))) return false;
    return true;
  });

  const facetAmenities = [...amenityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: amenityLabel(key), count }));

  const bookingQuery = new URLSearchParams();
  if (checkIn) bookingQuery.set("checkIn", checkIn);
  if (checkOut) bookingQuery.set("checkOut", checkOut);
  if (guests) bookingQuery.set("guests", guests);
  if (occ) bookingQuery.set("occ", occ);
  const bookingSuffix = bookingQuery.toString() ? `?${bookingQuery.toString()}` : "";

  // The hero h1 already names the city, so the results heading is just the count.
  const heading = `${hotels.length} propert${hotels.length === 1 ? "y" : "ies"}`;

  return (
    <div>
      {/* Structured data lives at page level — a <script> rendered inside a
          nested component is never executed on a client render. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(HOTEL_FAQS)) }}
      />

      {/* Hero — photo backdrop, heading, and the bordered search bar */}
      <section className="relative isolate overflow-hidden bg-sidebar">
        <Image
          src="/marketing/hotels-hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/40" aria-hidden />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-10 sm:px-6 lg:px-8 lg:pt-14 lg:pb-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-white drop-shadow-lg sm:text-4xl">
            {city ? `Hotels in ${city}` : "Hotels across Somalia and beyond"}
          </h1>

          {/* Accent-outlined search bar, as in the reference */}
          <div className="mt-6 rounded-xl border-2 border-brand-accent">
            <HotelSearchFilters initial={{ city, checkIn, checkOut, guests, occ }} />
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-2 text-sm font-medium text-white/85 drop-shadow">
                <point.icon className="size-4 shrink-0 text-teal-300" aria-hidden /> {point.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Results — filter sidebar + list */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          <aside aria-label="Filters" className="hidden lg:sticky lg:top-44 lg:block lg:self-start">
            <Suspense fallback={<div className="h-96 rounded-xl border border-border bg-card" />}>
              <HotelFilters amenities={facetAmenities} counts={{ stars: starCounts, price: priceCounts }} />
            </Suspense>
          </aside>

          {/* A <section>, not <main>: the marketing layout already owns the
              page's one <main> landmark. */}
          <section aria-labelledby="hotel-results-heading" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="hotel-results-heading" className="font-heading text-xl font-bold">
                  {heading}
                </h2>
                {hotels.length !== all.length ? (
                  <p className="text-sm text-muted-foreground tabular-nums">Filtered from {all.length}</p>
                ) : null}
              </div>
              <Suspense fallback={null}>
                <HotelFiltersSheet amenities={facetAmenities} counts={{ stars: starCounts, price: priceCounts }} />
              </Suspense>
            </div>

            {hotels.length > 0 ? (
              <div className="mt-4 space-y-4">
                {hotels.map((hotel) => (
                  <HotelListRow key={hotel.id} hotel={hotel} bookingSuffix={bookingSuffix} />
                ))}
              </div>
            ) : (
              <Empty className="mt-6 border border-border bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">No properties match those filters</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" render={<Link href="/hotels" />}>
                    Browse all hotels
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </section>
        </div>
      </div>

      {/* Themed rails, FAQ and discovery content */}
      <HotelRail
        className="bg-muted/40"
        title="Hotels in the centre, close to business"
        seeAll={{ label: "See all", href: "/hotels?city=Mogadishu" }}
        properties={CENTRAL_STAYS}
      />
      <HotelRail
        title="Best for a longer stay"
        seeAll={{ label: "See all", href: "/hotels" }}
        properties={LEISURE_STAYS}
      />

      <HotelsFaq city={city || undefined} />
      <GuestVoices city={city || undefined} />
      <ExploreMore />
    </div>
  );
}
