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

/**
 * "Travel deals under $X" — image-topped route cards on the dark canvas,
 * matching the reference's deal rail.
 */
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
    <section className="bg-sidebar py-12 text-sidebar-foreground sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
          <Link
            href={href}
            className="flex h-11 shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            Explore more
            <ArrowForwardIcon sx={{ fontSize: 15 }} aria-hidden />
          </Link>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-6">
          <CarouselRail ariaLabel={title} itemClassName="w-[236px] sm:w-[262px]">
            {deals.map((deal) => (
              <Link
                key={deal.city + deal.href}
                href={deal.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white transition-shadow duration-300 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
              >
                <div className="relative aspect-16/10 overflow-hidden">
                  <Image
                    src={deal.image}
                    alt=""
                    fill
                    sizes="262px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4 text-neutral-900">
                  <h3 className="font-heading text-base font-bold">{deal.city}</h3>
                  <p className="mt-1 text-xs text-neutral-600">{deal.duration}</p>
                  <p className="text-xs text-neutral-600">{deal.dates}</p>
                  <p className="mt-auto pt-4 font-heading text-lg font-extrabold text-neutral-900 tabular-nums">
                    <span className="text-xs font-medium text-neutral-600">from </span>
                    {deal.price}
                  </p>
                </div>
              </Link>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
