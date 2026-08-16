"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/components/ui/aceternity/motion-primitives";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { PlaceIcon, SearchIcon } from "@/components/ui/mui-icons";
import { HeroDealCard, type HeroDeal } from "@/components/marketing/hero-deal-card";
/* Offer copy is placeholder marketing — swap for real campaign data at launch. */
const SLIDES = [
  {
    image: "/marketing/slide-gulf-city.webp",
    eyebrow: "Gulf & Middle East",
    title: "Direct Fares to Dubai & Doha",
    subtitle: "Business trips and family visits, sorted in minutes",
    priceLabel: "Starting @",
    price: "$240",
    priceSuffix: "one way",
    href: "/flights?origin=MGQ&destination=DXB",
    cta: "Explore fares",
    titleFont: "font-display tracking-tight",
    deal: {
      kind: "flight",
      tag: "Limited seats",
      fromCode: "MGQ",
      fromLabel: "Mogadishu",
      toCode: "DXB",
      toLabel: "Dubai",
      meta: [
        { label: "Departs", value: "Daily" },
        { label: "Cabin", value: "Economy" },
      ],
      price: "$240",
      priceSuffix: "one way, per person",
    } satisfies HeroDeal,
  },
  {
    image: "/marketing/slide-dunes.webp",
    eyebrow: "Umrah season",
    title: "Guided Umrah for Families & Groups",
    subtitle: "Flights, visa, hotels near the Haram and a guide throughout",
    priceLabel: "Starting @",
    price: "$1,250",
    priceSuffix: "per pilgrim",
    href: "/umrah",
    cta: "Browse packages",
    // Amiri is a serif; `tracking-tight` closes its apertures at display size.
    titleFont: "font-islamic tracking-normal",
    deal: {
      kind: "umrah",
      tag: "Season fares",
      fromCode: "MGQ",
      fromLabel: "Mogadishu",
      toCode: "JED",
      toLabel: "Jeddah",
      meta: [
        { label: "Duration", value: "14 days" },
        { label: "Includes", value: "Visa + hotels" },
      ],
      price: "$1,250",
      priceSuffix: "per pilgrim",
    } satisfies HeroDeal,
  },
  {
    image: "/marketing/slide-coast.webp",
    eyebrow: "Somalia & East Africa",
    title: "Seafront Stays Along the Somali Coast",
    subtitle: "Verified hotels at confirmed rates, booked in your own currency",
    priceLabel: "Starting @",
    price: "$45",
    priceSuffix: "per night",
    href: "/hotels?city=Mogadishu",
    cta: "Find a stay",
    // ADLaM Display ships one 400 weight, so the base `font-bold` makes the
    // browser synthesise a smeared faux-bold. font-normal (last class wins via
    // twMerge) keeps the real letterforms — the face is broad enough already.
    titleFont: "font-african font-normal tracking-tight",
    deal: {
      kind: "stay",
      tag: "Best rate",
      fromCode: "MGQ",
      fromLabel: "Mogadishu seafront",
      toCode: "3N",
      toLabel: "Verified partner",
      meta: [
        { label: "Check-in", value: "Flexible" },
        { label: "Breakfast", value: "Included" },
      ],
      price: "$45",
      priceSuffix: "per night",
    } satisfies HeroDeal,
  },
  {
    image: "/marketing/slide-istanbul.webp",
    eyebrow: "Turkey & Europe Gateway",
    title: "Fly to Istanbul, Direct",
    subtitle: "Turkish Airlines connections to Europe, sorted from Mogadishu",
    priceLabel: "Starting @",
    price: "$320",
    priceSuffix: "one way",
    href: "/flights?origin=MGQ&destination=IST",
    cta: "Explore fares",
    titleFont: "font-display tracking-tight",
    deal: {
      kind: "flight",
      tag: "Daily flights",
      fromCode: "MGQ",
      fromLabel: "Mogadishu",
      toCode: "IST",
      toLabel: "Istanbul",
      meta: [
        { label: "Departs", value: "Daily" },
        { label: "Cabin", value: "Economy" },
      ],
      price: "$320",
      priceSuffix: "one way, per person",
    } satisfies HeroDeal,
  },
  {
    image: "/marketing/slide-nairobi.webp",
    eyebrow: "East Africa Regional",
    title: "City Stays in Nairobi",
    subtitle: "Business trips and layovers, verified hotels near the CBD",
    priceLabel: "Starting @",
    price: "$60",
    priceSuffix: "per night",
    href: "/hotels?city=Nairobi",
    cta: "Find a stay",
    titleFont: "font-display tracking-tight",
    deal: {
      kind: "stay",
      tag: "Popular route",
      fromCode: "NBO",
      fromLabel: "Nairobi CBD",
      toCode: "2N",
      toLabel: "Verified partner",
      meta: [
        { label: "Check-in", value: "Flexible" },
        { label: "Breakfast", value: "Included" },
      ],
      price: "$60",
      priceSuffix: "per night",
    } satisfies HeroDeal,
  },
];

const SLIDE_MS = 6500;

export function HeroCarousel() {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => setIndex((next + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (reduced || paused) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [reduced, paused]);

  return (
    <section
      className="relative isolate min-h-[540px] overflow-hidden bg-sidebar lg:min-h-[620px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured travel offers"
    >
      {/* Slides live in one flex track that translates by -index * 100%.
          Deliberately NOT AnimatePresence: with mount/unmount transitions,
          rapid slide changes (a dot click landing on top of the auto-advance
          tick) leave stale children wedged off-screen and `mode="wait"`
          deadlocks waiting on an exit that never resolves. A single always-
          mounted track has no such race — and the copy sits inside each slide,
          so image and text travel together for free.

          The translate is a plain CSS transform, NOT a motion `animate` prop:
          Motion cannot interpolate a percentage `x` with no defined starting
          value and silently resolves it to `transform: none`, leaving the
          track parked on slide 1 forever. A CSS percentage translate is
          resolved against the track's own border box (one slide wide), so
          -100% is exactly one slide, and it stays on the compositor. */}
      <div
        className="absolute inset-0 flex will-change-transform"
        style={{
          transform: `translate3d(-${index * 100}%, 0, 0)`,
          transition: reduced ? "none" : "transform 850ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {SLIDES.map((s, i) => (
          <div key={s.image} className="relative h-full w-full shrink-0">
            <Image
              src={s.image}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />

            {/* Scrim — heavy on the left where the offer card sits */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/25" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center justify-between gap-10 px-4 pt-14 pb-36 sm:px-6 lg:px-8 lg:pb-40">
              <div className="max-w-xl" aria-hidden={i !== index}>
                <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider text-white uppercase backdrop-blur-sm">
                  {s.eyebrow}
                </span>

                {/* Only the live slide carries the h1 — three <h1>s would be a
                    document-outline bug even though two are off-screen. */}
                {i === index ? (
                  <h1 className={cn("mt-4 text-4xl leading-[1.06] font-bold text-balance text-white sm:text-5xl lg:text-[3.4rem]", s.titleFont)}>
                    {s.title}
                  </h1>
                ) : (
                  <p className={cn("mt-4 text-4xl leading-[1.06] font-bold text-balance text-white sm:text-5xl lg:text-[3.4rem]", s.titleFont)}>
                    {s.title}
                  </p>
                )}
                <p className="mt-3 max-w-md text-lg leading-relaxed text-white/85">{s.subtitle}</p>

                {/* Price banner */}
                <div className="mt-6 inline-flex items-baseline gap-2 rounded-xl bg-white px-5 py-3 shadow-2xl">
                  <span className="font-heading text-lg font-bold text-foreground">{s.priceLabel}</span>
                  <span className="font-heading text-3xl font-extrabold text-brand-accent sm:text-4xl">{s.price}</span>
                  <span className="text-sm font-medium text-muted-foreground">{s.priceSuffix}</span>
                </div>

                <div>
                  <Link
                    href={s.href}
                    tabIndex={i === index ? undefined : -1}
                    className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-accent px-8 font-heading text-base font-bold text-brand-accent-foreground shadow-lg transition-all duration-200 hover:bg-brand-accent/90 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 focus-visible:outline-none"
                  >
                    {s.cta}
                  </Link>
                </div>
              </div>

              {/* Deal advert fills the hero's right half. Hidden below lg,
                  where the copy and search need the full width. */}
              <HeroDealCard
                deal={s.deal}
                className="hidden shrink-0 lg:block"
                aria-hidden={i !== index}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Centered destination search, overlapping the hero's lower edge */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-4 sm:px-6 lg:bottom-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(query.trim() ? `/hotels?city=${encodeURIComponent(query.trim())}` : "/hotels");
          }}
          className="mx-auto flex max-w-2xl items-center rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/40"
        >
          <div className="relative flex-1">
            <PlaceIcon
              sx={{ fontSize: 24 }}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a destination — Mogadishu, Dubai, Istanbul…"
              aria-label="Search a destination"
              autoComplete="off"
              className="h-12 w-full bg-transparent pr-3 pl-12 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
          <button
            type="submit"
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-brand-accent px-6 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-8"
          >
            <SearchIcon sx={{ fontSize: 18 }} />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
      </div>

      {/* Slide dots */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show slide ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className={cn(
              "h-2 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
              i === index ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            )}
          />
        ))}
      </div>
    </section>
  );
}
