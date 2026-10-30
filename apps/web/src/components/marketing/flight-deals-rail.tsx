"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowForwardIcon } from "@/components/ui/mui-icons";
import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";

export type FlightDeal = {
  city: string;
  image: string;
  duration: string;
  dates: string;
  price: string;
  href: string;
};

/** Destination inspiration; prices are reserved for live search results. */
export function FlightDealsRail({
  title,
  href,
  deals,
}: {
  title: string;
  href: string;
  deals: FlightDeal[];
}) {
  return (
    <section id="flight-destinations" className="scroll-mt-24 border-b border-border bg-background py-12 text-foreground sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="flex items-center justify-between gap-4">
          <div><span className="mb-2 block text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">A change of scenery</span><h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2></div>
          <Link
            href={href}
            className="flex h-11 shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-primary transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            Find a flight
            <ArrowForwardIcon sx={{ fontSize: 15 }} aria-hidden />
          </Link>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-6">
          <CarouselRail ariaLabel={title} itemClassName="w-[250px] sm:w-[280px]">
            {deals.map((deal) => (
              <Link
                key={deal.city + deal.href}
                href={deal.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={deal.image}
                    alt=""
                    fill
                    sizes="280px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Flights to</span>
                    <h3 className="mt-1 font-heading text-xl font-semibold text-foreground">{deal.city}</h3>
                  </div>
                  <span className="grid size-9 place-items-center rounded-full border border-border text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-white"><ArrowForwardIcon sx={{ fontSize: 17 }} aria-hidden /></span>
                </div>
              </Link>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
