"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
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
 * The one image card every home-page rail uses (destinations, recommended
 * packages, seasonal picks): 4:3 photo, title, meta line, price. Hover zooms
 * the photo only — no tilt, no lift — so a row of them stays calm.
 */
export function DestinationCard({
  card,
  priceLabel = "Starting from",
}: {
  card: RailCard;
  priceLabel?: string;
}) {
  return (
    <Link
      href={card.href}
      className="group block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-muted">
        <Image
          src={card.image}
          alt=""
          fill
          sizes="(min-width: 640px) 272px, 248px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {card.badge ? (
          <span className="absolute top-3 left-3 rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-bold text-brand-accent-foreground shadow">
            {card.badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 font-heading text-base leading-snug font-bold transition-colors group-hover:text-primary">
        {card.title}
      </h3>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{card.meta ?? priceLabel}</span>
        <span className="font-heading text-lg font-bold text-foreground tabular-nums">{card.price}</span>
      </div>
    </Link>
  );
}

/**
 * Reusable "trending destinations" band: heading + collapsible blurb, then a
 * snap carousel of image cards. Used for both the international and regional
 * sections.
 */
export function DestinationRail({
  id,
  title,
  blurb,
  cards,
  viewAll,
  className,
  priceLabel = "Starting from",
}: {
  id?: string;
  title: string;
  blurb?: string;
  cards: RailCard[];
  viewAll?: { label: string; href: string };
  className?: string;
  priceLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-24", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
            {blurb ? (
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                <span className={cn(!expanded && "line-clamp-2")}>{blurb}</span>{" "}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="rounded-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {expanded ? "Read less" : "Read more"}
                </button>
              </p>
            ) : null}
          </div>
          {viewAll ? (
            <Link
              href={viewAll.href}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 self-start rounded-lg border-2 border-brand-accent px-6 font-heading text-sm font-bold text-brand-accent transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:self-auto"
            >
              {viewAll.label}
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
          ) : null}
        </FadeIn>

        <FadeIn delay={0.1} className="mt-10">
          <CarouselRail ariaLabel={title} itemClassName="w-[248px] sm:w-[272px]">
            {cards.map((card) => (
              <DestinationCard key={card.href + card.title} card={card} priceLabel={priceLabel} />
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
