import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { searchHotels } from "@/modules/hotels/queries";
import { HotelListRow } from "@/modules/hotels/components/hotel-list-row";
import { amenityLabel } from "@/modules/hotels/images";
import { HotelSearchFilters } from "./hotel-search-filters";
import { HotelFilters, HotelFiltersSheet } from "./hotel-filters";
import { priceBandOf } from "@/modules/hotels/price-bands";
import { HotelsCollectionHero } from "@/components/marketing/travel-collection-heroes";
import styles from "@/components/marketing/travel-collection.module.css";
import { HotelsFaq, ExploreMore, HOTEL_FAQS } from "@/components/marketing/hotels-extras";
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

const DESTINATIONS = [
  { name: "Mogadishu", image: "/marketing/slide-coast.webp", region: "Somalia" },
  { name: "Hargeisa", image: "/marketing/dest-hargeisa.webp", region: "Somalia" },
  { name: "Nairobi", image: "/marketing/slide-nairobi.webp", region: "Kenya" },
];
const PAGE_SIZE = 12;

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
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const {
    city = "",
    checkIn = "",
    checkOut = "",
    guests = "",
    occ = "",
    stars = "",
    price = "",
    amenities = "",
  } = params;

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

  const pageCount = Math.max(1, Math.ceil(hotels.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const visibleHotels = hotels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (next: number) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value && key !== "page") query.set(key, value); });
    if (next > 1) query.set("page", String(next));
    return `/hotels${query.size ? `?${query.toString()}` : ""}#hotel-results-heading`;
  };
  const heading = `${hotels.length} ${hotels.length === 1 ? "property" : "properties"}`;

  return (
    <div>
      {/* Structured data lives at page level — a <script> rendered inside a
          nested component is never executed on a client render. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(HOTEL_FAQS)) }}
      />

      <HotelsCollectionHero city={city}>
        <HotelSearchFilters key={[city, checkIn, checkOut, guests, occ].join("|")} initial={{ city, checkIn, checkOut, guests, occ }} />
      </HotelsCollectionHero>

      {/* Results — filter sidebar + list */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside aria-label="Filters" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
            <Suspense fallback={<div className="h-96 rounded-xl border border-border bg-card" />}>
              <HotelFilters amenities={facetAmenities} counts={{ stars: starCounts, price: priceCounts }} />
            </Suspense>
          </aside>

          {/* A <section>, not <main>: the marketing layout already owns the
              page's one <main> landmark. */}
          <section aria-labelledby="hotel-results-heading" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="hotel-results-heading" className="scroll-mt-32 font-heading text-2xl font-semibold tracking-tight">
                  {heading}
                </h2>
                {hotels.length !== all.length ? (
                  <span className="text-xs text-muted-foreground tabular-nums">of {all.length} matches</span>
                ) : null}
              </div>
              <Suspense fallback={null}>
                <HotelFiltersSheet amenities={facetAmenities} counts={{ stars: starCounts, price: priceCounts }} />
              </Suspense>
            </div>

            {hotels.length > 0 ? (
              <div className="mt-6 space-y-5">
                {visibleHotels.map((hotel) => (
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
            {pageCount > 1 ? (
              <nav aria-label="Hotel result pages" className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                <span className="text-xs text-muted-foreground tabular-nums">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, hotels.length)} of {hotels.length} properties</span>
                <div className="flex items-center gap-3">
                  {page > 1 ? <Link href={pageHref(page - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-3.5" aria-hidden="true" />Previous</Link> : null}
                  <span className="text-xs text-muted-foreground tabular-nums">{page} / {pageCount}</span>
                  {page < pageCount ? <Link href={pageHref(page + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">Next<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
                </div>
              </nav>
            ) : null}
          </section>
        </div>
      </div>

      <section className="border-t border-border bg-secondary/30 py-14 sm:py-20" aria-labelledby="hotel-destinations">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><h2 id="hotel-destinations" className="font-heading text-3xl font-semibold tracking-tight">Where will you stay next?</h2><Link href="/hotels" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-primary">All destinations<ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>
          <div className={styles.destinationGrid}>
            {DESTINATIONS.map((destination) => <Link key={destination.name} href={`/hotels?city=${encodeURIComponent(destination.name)}`} className={`${styles.destination} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary`}>
              <Image src={destination.image} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
              <div className="absolute inset-x-6 bottom-6 z-10 flex items-end justify-between gap-4"><div><span className="text-[10px] tracking-widest text-white/70 uppercase">{destination.region}</span><h3 className="mt-1 font-heading text-2xl font-medium">{destination.name}</h3></div><ArrowUpRight className="size-5" aria-hidden="true" /></div>
            </Link>)}
          </div>
        </div>
      </section>

      <HotelsFaq city={city || undefined} />
      <ExploreMore />
    </div>
  );
}
