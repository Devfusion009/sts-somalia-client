"use client";

import Image from "next/image";
import Link from "next/link";
import { StarIcon, ArrowForwardIcon } from "@/components/ui/mui-icons";
import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";

export type RailProperty = {
  name: string;
  image: string;
  location: string;
  stars?: number;
  price?: string;
  note?: string;
  href: string;
};

/**
 * Themed property rail ("Budget stays", "Hotels in the centre", …) — the
 * horizontal card strips that run below the result list on the reference site.
 */
export function HotelRail({
  title,
  seeAll,
  properties,
  className,
}: {
  title: string;
  seeAll: { label: string; href: string };
  properties: RailProperty[];
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <FadeIn className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <Link
            href={seeAll.href}
            className="flex h-11 shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {seeAll.label}
            <ArrowForwardIcon sx={{ fontSize: 15 }} aria-hidden />
          </Link>
        </FadeIn>

        <FadeIn delay={0.08} className="mt-6">
          <CarouselRail ariaLabel={title} itemClassName="w-[228px] sm:w-[250px]">
            {properties.map((property) => (
              <Link
                key={property.name + property.href}
                href={property.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-muted">
                  <Image
                    src={property.image}
                    alt=""
                    fill
                    sizes="250px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-3.5">
                  <h3 className="font-heading text-sm leading-snug font-bold group-hover:text-primary">
                    {property.name}
                  </h3>
                  {property.stars ? (
                    <span className="mt-1 flex" role="img" aria-label={`${property.stars} star`}>
                      {Array.from({ length: property.stars }).map((_, i) => (
                        <StarIcon key={i} sx={{ fontSize: 13 }} className="text-brand-gold" />
                      ))}
                    </span>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">{property.location}</p>
                  {property.note ? (
                    <p className="mt-1.5 text-xs font-medium text-primary">{property.note}</p>
                  ) : null}
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    {property.price ? (
                      <>
                        From <span className="font-heading text-sm font-bold text-foreground tabular-nums">{property.price}</span>{" "}
                        per night
                      </>
                    ) : (
                      "Price on request"
                    )}
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
