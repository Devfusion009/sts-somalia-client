"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn, TiltCard } from "@/components/ui/aceternity/motion-primitives";
import { cn } from "@/lib/utils";

import { ArrowForwardIcon } from "@/components/ui/mui-icons";
export type RailCard = {
  title: string;
  image: string;
  price: string;
  meta?: string;
  href: string;
  badge?: string;
};

/**
 * Reusable "trending destinations" band: heading + collapsible blurb, then a
 * snap carousel of image cards. Used for both the international and regional
 * sections, and for the seasonal picker's package rail.
 */
export function DestinationRail({
  id,
  eyebrow,
  title,
  blurb,
  cards,
  viewAll,
  className,
  priceLabel = "Starting from",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  blurb?: string;
  cards: RailCard[];
  viewAll?: { label: string; href: string };
  className?: string;
  priceLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section id={id} className={cn("py-14 sm:py-16 lg:py-20", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          {blurb ? (
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              <span className={cn(!expanded && "line-clamp-2")}>{blurb}</span>{" "}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="font-semibold text-brand-accent hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {expanded ? "Read less" : "Read more"}
              </button>
            </p>
          ) : null}
        </FadeIn>

        <FadeIn delay={0.1} className="mt-8">
          <CarouselRail ariaLabel={title} itemClassName="w-[248px] sm:w-[272px]">
            {cards.map((card) => (
              <TiltCard key={card.href + card.title} max={5}>
                <Link
                  href={card.href}
                  className="group block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="relative aspect-4/3 overflow-hidden rounded-2xl">
                    <Image
                      src={card.image}
                      alt=""
                      fill
                      sizes="272px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    {card.badge ? (
                      <span className="absolute top-3 left-3 rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-bold text-brand-accent-foreground shadow">
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-heading text-base leading-snug font-bold transition-colors group-hover:text-primary">
                    {card.title}
                  </h3>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{card.meta ?? priceLabel}</span>
                    <span className="font-heading text-lg font-bold text-foreground">{card.price}</span>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </CarouselRail>
        </FadeIn>

        {viewAll ? (
          <FadeIn delay={0.15} className="mt-10 flex justify-center">
            <Link
              href={viewAll.href}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border-2 border-brand-accent px-7 font-heading text-sm font-bold text-brand-accent transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {viewAll.label}
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
          </FadeIn>
        ) : null}
      </div>
    </section>
  );
}
