"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { cn } from "@/lib/utils";

import { AcUnitIcon, GrainIcon, WbSunnyIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
type Season = {
  key: string;
  label: string;
  icon: SvgIconComponent;
  headline: string;
  blurb: string;
  /** Warm/cool wash behind the band, tuned per season. */
  wash: string;
  cards: Array<{ title: string; image: string; days: string; price: string; href: string }>;
};

/* Seasons are framed around the Somali travel calendar (Jilaal / Xagaa / Gu). */
const SEASONS: Season[] = [
  {
    key: "jilaal",
    label: "Jilaal · Dec–Mar",
    icon: AcUnitIcon,
    headline: "Cool, dry and the easiest time to fly",
    blurb:
      "The dry season brings the calmest skies and the widest fare choice. Ideal for Gulf city breaks, family visits and first-time travellers who want everything to run predictably.",
    wash: "from-sky-100 via-background to-background dark:from-sky-950/40",
    cards: [
      { title: "Dubai City Break", image: "/marketing/dubai.webp", days: "5 days", price: "$620", href: "/hotels?city=Dubai" },
      { title: "Doha & the Gulf", image: "/marketing/slide-gulf-city.webp", days: "4 days", price: "$580", href: "/flights" },
      { title: "Nairobi Getaway", image: "/marketing/kenya.webp", days: "4 days", price: "$410", href: "/hotels?city=Nairobi" },
      { title: "Cairo & the Nile", image: "/marketing/dest-cairo.webp", days: "6 days", price: "$690", href: "/hotels?city=Cairo" },
    ],
  },
  {
    key: "xagaa",
    label: "Xagaa · Jun–Sep",
    icon: WbSunnyIcon,
    headline: "Long days, school holidays and group travel",
    blurb:
      "Peak family season. Book early for Umrah groups and multi-generation trips — the best hotels near the Haram and the larger family rooms abroad go first.",
    wash: "from-amber-100 via-background to-background dark:from-amber-950/40",
    cards: [
      { title: "Umrah — Standard", image: "/marketing/madinah.webp", days: "14 days", price: "$1,850", href: "/umrah" },
      { title: "Istanbul Discovery", image: "/marketing/istanbul.webp", days: "6 days", price: "$840", href: "/hotels?city=Istanbul" },
      { title: "Kuala Lumpur Escape", image: "/marketing/dest-kuala-lumpur.webp", days: "7 days", price: "$1,140", href: "/hotels?city=Kuala%20Lumpur" },
      { title: "Jeddah & Red Sea", image: "/marketing/dest-jeddah.webp", days: "5 days", price: "$720", href: "/hotels?city=Jeddah" },
    ],
  },
  {
    key: "gu",
    label: "Gu · Apr–May",
    icon: GrainIcon,
    headline: "Green season, quieter cities, better rates",
    blurb:
      "The rains green the countryside and fares soften. The smart window for business trips, medical travel and anyone who would rather not share the city with peak-season crowds.",
    wash: "from-emerald-100 via-background to-background dark:from-emerald-950/40",
    cards: [
      { title: "Addis Ababa Highlands", image: "/marketing/dest-addis.webp", days: "4 days", price: "$390", href: "/hotels?city=Addis%20Ababa" },
      { title: "Hargeisa & Somaliland", image: "/marketing/dest-hargeisa.webp", days: "3 days", price: "$210", href: "/hotels?city=Hargeisa" },
      { title: "Mogadishu Seafront", image: "/marketing/slide-coast.webp", days: "3 days", price: "$180", href: "/hotels?city=Mogadishu" },
      { title: "Nairobi Getaway", image: "/marketing/kenya.webp", days: "4 days", price: "$410", href: "/hotels?city=Nairobi" },
    ],
  },
];

export function SeasonPicker() {
  const [active, setActive] = useState(0);
  const season = SEASONS[active];

  return (
    <section className={cn("relative bg-gradient-to-b py-14 transition-colors duration-700 sm:py-16 lg:py-20", season.wash)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
            Not sure when to go, or where?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Pick a season and we&rsquo;ll show what travels best in it.
          </p>

          <div role="tablist" aria-label="Travel season" className="mt-7 flex flex-wrap justify-center gap-2.5">
            {SEASONS.map((s, i) => {
              const Icon = s.icon;
              const selected = i === active;
              return (
                <button
                  key={s.key}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-lg px-5 font-heading text-sm font-bold transition-all duration-200",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                    selected
                      ? "bg-brand-accent text-brand-accent-foreground shadow-lg"
                      : "bg-sidebar text-sidebar-foreground hover:bg-sidebar/85"
                  )}
                >
                  <Icon sx={{ fontSize: 18 }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </FadeIn>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${season.key}-copy`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card/80 p-7 backdrop-blur lg:col-span-4"
            >
              <h3 className="font-heading text-2xl leading-tight font-bold text-balance">{season.headline}</h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">{season.blurb}</p>
            </motion.div>
          </AnimatePresence>

          <div className="min-w-0 lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${season.key}-cards`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <CarouselRail ariaLabel={`${season.label} packages`} itemClassName="w-[230px] sm:w-[248px]">
                  {season.cards.map((card) => (
                    <Link
                      key={card.title}
                      href={card.href}
                      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <div className="relative aspect-4/3 overflow-hidden">
                        <Image
                          src={card.image}
                          alt=""
                          fill
                          sizes="248px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4">
                        <h4 className="font-heading text-sm leading-snug font-bold transition-colors group-hover:text-primary">
                          {card.title}
                        </h4>
                        <div className="mt-2.5 flex items-end justify-between">
                          <span className="text-xs text-muted-foreground">{card.days}</span>
                          <span className="font-heading text-base font-bold text-brand-accent">{card.price}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </CarouselRail>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
