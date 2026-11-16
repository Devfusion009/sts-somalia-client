"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
    <section id="flight-destinations" className="scroll-mt-24 bg-background pt-12 pb-8 text-foreground sm:pt-16 sm:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="flex items-center justify-between gap-4">
          <div><span className="mb-2 block text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">From Mogadishu</span><h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2></div>
          <Link
            href={href}
            className="flex h-11 shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-primary transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            Find a flight
            <ArrowForwardIcon sx={{ fontSize: 15 }} aria-hidden />
          </Link>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-6">
          <CarouselRail ariaLabel={title} itemClassName="w-[85%] sm:w-[calc((100%_-_24px)/2)] lg:w-[calc((100%_-_48px)/3)]">
            {deals.map((deal) => (
              <Link
                key={deal.city + deal.href}
                href={deal.href}
                className="group relative isolate block aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-[#073c34] text-white shadow-sm transition-shadow duration-300 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                  <Image
                    src={deal.image}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 390px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
                    className="-z-20 object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
                  />
                <div className="absolute inset-0 -z-10 bg-linear-to-t from-[#032b25]/90 via-[#032b25]/5 to-black/15" aria-hidden="true" />
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#052f29]/65 p-4 backdrop-blur-md sm:p-5">
                  <div>
                    <span className="text-[10px] font-medium text-white/75">Mogadishu to</span>
                    <h3 className="mt-0.5 font-heading text-2xl leading-tight font-medium tracking-tight sm:text-[1.7rem]">{deal.city}</h3>
                    <span className="mt-2 block text-xs text-white/80">Find flights <span aria-hidden="true">→</span></span>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#073c34] transition-colors group-hover:bg-[#fa7416] group-hover:text-white"><ArrowUpRight className="size-5" aria-hidden="true" /></span>
                </div>
              </Link>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
