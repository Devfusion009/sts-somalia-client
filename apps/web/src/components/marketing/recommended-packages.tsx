"use client";

import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { SectionHeading } from "@/components/marketing/section-heading";
import { DestinationCard } from "@/components/marketing/destination-rail";

/* Placeholder prices — replace with live data at launch. The catalogue-size
   counters that sat beside this rail were cut: invented "300+ hotels" style
   figures are claims the business cannot back. */

const PACKAGES = [
  {
    title: "Dubai City Break",
    offer: "Mega Offer",
    image: "/marketing/dubai.webp",
    price: "$620",
    meta: "5 days · flights + hotel",
    href: "/hotels?city=Dubai",
  },
  {
    title: "Istanbul Discovery",
    image: "/marketing/istanbul.webp",
    price: "$840",
    meta: "6 days · flights + hotel",
    href: "/hotels?city=Istanbul",
  },
  {
    title: "Umrah — Standard",
    offer: "Mega Offer",
    image: "/marketing/madinah.webp",
    price: "$1,850",
    meta: "14 days · full package",
    href: "/umrah",
  },
  {
    title: "Nairobi Business Trip",
    image: "/marketing/kenya.webp",
    price: "$410",
    meta: "4 days · flights + hotel",
    href: "/hotels?city=Nairobi",
  },
  {
    title: "Jeddah & Red Sea",
    offer: "Mega Offer",
    image: "/marketing/dest-jeddah.webp",
    price: "$720",
    meta: "5 days · flights + hotel",
    href: "/hotels?city=Jeddah",
  },
  {
    title: "Kuala Lumpur Escape",
    image: "/marketing/dest-kuala-lumpur.webp",
    price: "$1,140",
    meta: "7 days · flights + hotel",
    href: "/hotels?city=Kuala%20Lumpur",
  },
];

export function RecommendedPackages() {
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <SectionHeading align="left" title="Recommended packages" />
        </FadeIn>

        <FadeIn delay={0.1} className="mt-10">
          <CarouselRail ariaLabel="Recommended packages" itemClassName="w-[248px] sm:w-[272px]">
            {PACKAGES.map((pkg) => (
              <DestinationCard key={pkg.title} card={pkg} />
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
