"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { usePrefersReducedMotion } from "@/components/ui/aceternity/motion-primitives";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { PlaceIcon, SearchIcon } from "@/components/ui/mui-icons";
import { HeroDealCard, type HeroDeal } from "@/components/marketing/hero-deal-card";
/* Offer copy is placeholder marketing — swap for real campaign data at launch. */
const SLIDES = [
  {
    image: "/marketing/slide-gulf-city.webp",
    video: "/marketing/slide-gulf-city.mp4",
    eyebrow: "Gulf & Middle East",
    title: "Direct Fares to Dubai & Doha",
    subtitle: "Business trips and family visits from Mogadishu",
    priceLabel: "From",
    price: "$240",
    priceSuffix: "one way",
    href: "/flights?origin=MGQ&destination=DXB",
    cta: "Explore fares",
    titleFont: "font-display tracking-tight",
    deal: {
      kind: "flight",
      tag: "Fare guide",
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
    video: "/marketing/slide-dunes.mp4",
    eyebrow: "Umrah season",
    title: "Guided Umrah for Families & Groups",
    subtitle: "Flights, visa, hotels near the Haram and a guide throughout",
    priceLabel: "From",
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
    video: "/marketing/slide-coast.mp4",
    eyebrow: "Somalia & East Africa",
    title: "Seafront Stays Along the Somali Coast",
    subtitle: "Verified hotels at confirmed rates, booked in your own currency",
    priceLabel: "From",
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
      tag: "Partner hotel",
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
    video: "/marketing/slide-istanbul.mp4",
    eyebrow: "Turkey & Europe Gateway",
    title: "Fly to Istanbul, Direct",
    subtitle: "Turkish Airlines connections to Europe, sorted from Mogadishu",
    priceLabel: "From",
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
    video: "/marketing/slide-nairobi.mp4",
    eyebrow: "East Africa Regional",
    title: "City Stays in Nairobi",
    subtitle: "Business trips and layovers, verified hotels near the CBD",
    priceLabel: "From",
    price: "$60",
    priceSuffix: "per night",
    href: "/hotels?city=Nairobi",
    cta: "Find a stay",
    titleFont: "font-display tracking-tight",
    deal: {
      kind: "stay",
      tag: "Partner hotel",
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

/* Per-slide palette, parallel to SLIDES: scrim tint, price chip, CTA glow. */
const THEMES = [
  { // Gulf skyline — night blue, gold light
    scrim: "from-[#050b1c]/85 via-[#0a1a38]/50 to-[#050b1c]/20",
    chip: "border-sky-200/25 bg-[#0a1a38]/45 shadow-sky-950/40",
    price: "text-amber-300",
    cta: "shadow-[0_8px_28px_-6px_rgba(251,191,36,0.55)]",
  },
  { // Dunes — sand, copper
    scrim: "from-[#2a1204]/85 via-[#3d1d08]/45 to-[#2a1204]/15",
    chip: "border-amber-200/30 bg-[#3d1d08]/45 shadow-amber-950/40",
    price: "text-amber-300",
    cta: "shadow-[0_8px_28px_-6px_rgba(244,113,28,0.6)]",
  },
  { // Coast — deep teal water
    scrim: "from-[#031c1d]/85 via-[#06312f]/45 to-[#031c1d]/15",
    chip: "border-teal-200/30 bg-[#06312f]/45 shadow-teal-950/40",
    price: "text-orange-300",
    cta: "shadow-[0_8px_28px_-6px_rgba(45,212,191,0.45)]",
  },
  { // Istanbul — midnight indigo, bridge lights
    scrim: "from-[#07061c]/88 via-[#14103a]/50 to-[#07061c]/20",
    chip: "border-indigo-200/25 bg-[#14103a]/50 shadow-indigo-950/40",
    price: "text-orange-300",
    cta: "shadow-[0_8px_28px_-6px_rgba(129,140,248,0.5)]",
  },
  { // Nairobi — green dusk
    scrim: "from-[#07170e]/85 via-[#0f2e1b]/45 to-[#07170e]/15",
    chip: "border-emerald-200/25 bg-[#0f2e1b]/45 shadow-emerald-950/40",
    price: "text-lime-300",
    cta: "shadow-[0_8px_28px_-6px_rgba(74,222,128,0.45)]",
  },
] as const;

const SLIDE_MS = 6500;

export function HeroCarousel() {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Hover and keyboard focus pause the rotation for as long as they last; the
  // pause button stops it until pressed again (WCAG 2.2.2).
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const paused = hovered || focused || stopped;

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
      className="relative isolate min-h-[600px] overflow-hidden bg-sidebar lg:min-h-[640px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
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
            {s.video && !reduced ? (
              <video
                key={s.video}
                autoPlay
                muted
                loop
                playsInline
                preload={i === 0 ? "auto" : "none"}
                poster={s.image}
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src={s.video} type="video/mp4" />
              </video>
            ) : (
              <Image
                src={s.image}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            )}

            {/* Scrim — heavy on the left where the offer card sits */}
            <div className={cn("absolute inset-0 bg-gradient-to-r", THEMES[i].scrim)} aria-hidden />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center justify-between gap-10 px-4 pt-14 pb-36 sm:px-6 lg:px-8 lg:pb-40">
              <div className="max-w-xl" aria-hidden={i !== index}>
                <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
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
                <div className={cn("mt-6 inline-flex items-baseline gap-2 rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-md", THEMES[i].chip)}>
                  <span className="font-heading text-lg font-semibold text-white/80">{s.priceLabel}</span>
                  <span className={cn("font-heading text-3xl font-extrabold sm:text-4xl", THEMES[i].price)}>{s.price}</span>
                  <span className="text-sm font-medium text-white/70">{s.priceSuffix}</span>
                </div>

                <div>
                  <Link
                    href={s.href}
                    tabIndex={i === index ? undefined : -1}
                    className={cn("mt-6 inline-flex h-12 items-center rounded-full bg-brand-accent px-8 font-heading text-base font-bold text-brand-accent-foreground transition-all duration-200 hover:bg-brand-accent/90", THEMES[i].cta, "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 focus-visible:outline-none")}
                  >
                    {s.cta}
                  </Link>
                </div>
              </div>

              {/* Deal advert fills the hero's right half. Hidden below lg,
                  where the copy and search need the full width. */}
              <HeroDealCard
                deal={s.deal}
                className="hidden shrink-0 self-start lg:block"
                aria-hidden={i !== index}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Destination search, aligned under the left copy column (not centered
          on the full viewport) so it can never drift under the deal card on
          the right at in-between widths — overlapping the hero's lower edge. */}
      <div className="absolute inset-x-0 bottom-16 z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:bottom-20 lg:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(query.trim() ? `/hotels?city=${encodeURIComponent(query.trim())}` : "/hotels");
          }}
          className="flex max-w-xl items-center rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/40"
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
              placeholder="Mogadishu, Dubai, Istanbul…"
              aria-label="Search a destination"
              autoComplete="off"
              className="h-12 w-full min-w-0 bg-transparent pr-3 pl-12 text-base text-neutral-900 outline-none placeholder:text-neutral-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            aria-label="Search hotels"
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-brand-accent px-6 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-8"
          >
            <SearchIcon sx={{ fontSize: 18 }} />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
      </div>

      {/* Slide dots — the visible pill is small, the hit area is 32px tall. */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show slide ${i + 1}: ${s.title}`}
            aria-current={i === index ? "true" : undefined}
            className="group/dot grid h-8 place-items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <span
              className={cn(
                "block h-2 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-white" : "w-2 bg-white/50 group-hover/dot:bg-white/80"
              )}
            />
          </button>
        ))}
        {reduced ? null : (
          <button
            type="button"
            onClick={() => setStopped((v) => !v)}
            aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
            className="ml-2 grid size-8 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            {stopped ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
          </button>
        )}
      </div>
    </section>
  );
}
