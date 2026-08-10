"use client";

import Image from "next/image";
import Link from "next/link";
import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { CountUp, FadeIn, TiltCard } from "@/components/ui/aceternity/motion-primitives";

/* Placeholder catalogue figures and prices — replace with live data at launch. */
const STATS = [
  { value: 120, suffix: "+", label: "International packages" },
  { value: 60, suffix: "+", label: "Regional & domestic packages" },
  { value: 300, suffix: "+", label: "Trusted partner hotels" },
];

const PACKAGES = [
  {
    title: "Dubai City Break",
    image: "/marketing/dubai.webp",
    price: "$620",
    meta: "5 days · flights + hotel",
    href: "/hotels?city=Dubai",
    badge: "Best seller",
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
    <section className="bg-background py-14 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        <FadeIn direction="right" className="lg:col-span-4">
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Recommended
            <br />
            packages
          </h2>
          <dl className="mt-8 space-y-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-4">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-heading text-4xl font-extrabold text-brand-accent tabular-nums sm:text-5xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </dd>
                <span aria-hidden className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </dl>
        </FadeIn>

        <FadeIn delay={0.12} className="min-w-0 lg:col-span-8">
          <CarouselRail ariaLabel="Recommended packages" itemClassName="w-[230px] sm:w-[248px]">
            {PACKAGES.map((pkg) => (
              <TiltCard key={pkg.title} max={5}>
                <Link
                  href={pkg.href}
                  className="group block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <Image
                      src={pkg.image}
                      alt=""
                      fill
                      sizes="248px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {pkg.badge ? (
                      <span className="absolute top-3 left-3 rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-bold text-brand-accent-foreground shadow">
                        {pkg.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-heading text-base leading-snug font-bold transition-colors group-hover:text-primary">
                    {pkg.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pkg.meta}</p>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Starting from</span>
                    <span className="font-heading text-lg font-bold text-foreground">{pkg.price}</span>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
