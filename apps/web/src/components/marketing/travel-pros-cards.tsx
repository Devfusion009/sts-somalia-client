"use client";

import Link from "next/link";
import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/ui/aceternity/motion-primitives";

/**
 * "For travel pros" — three utility cards (a "Price alerts" card was cut: no
 * fare-alert feature exists; it linked to the callback form) with flat-vector illustrations drawn
 * inline. The reference uses isometric 3D art; these are simplified brand-tinted
 * scenes built from primitives so they stay crisp, weightless and on-palette.
 */

const TEAL = "var(--primary)";
const ORANGE = "var(--brand-accent)";
const DEEP = "var(--sidebar)";

function ExpertArt() {
  return (
    <svg viewBox="0 0 120 90" fill="none" className="size-full" aria-hidden>
      {/* desk pad */}
      <ellipse cx="60" cy="78" rx="42" ry="7" fill={TEAL} opacity="0.14" />
      {/* speech bubble */}
      <rect x="58" y="12" width="46" height="30" rx="8" fill={TEAL} opacity="0.18" />
      <rect x="66" y="21" width="26" height="3.5" rx="1.75" fill={TEAL} />
      <rect x="66" y="29" width="18" height="3.5" rx="1.75" fill={TEAL} />
      <path d="M66 42l-6 8 14-8z" fill={TEAL} opacity="0.18" />
      {/* headset agent */}
      <circle cx="34" cy="34" r="13" fill={ORANGE} opacity="0.22" />
      <circle cx="34" cy="34" r="8" fill={ORANGE} />
      <path d="M20 36v-4a14 14 0 0 1 28 0v4" stroke={DEEP} strokeWidth="3" strokeLinecap="round" />
      <rect x="16" y="34" width="7" height="11" rx="3.5" fill={DEEP} />
      <rect x="45" y="34" width="7" height="11" rx="3.5" fill={DEEP} />
      <path d="M24 62a12 12 0 0 1 20 0" stroke={ORANGE} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function ExploreArt() {
  return (
    <svg viewBox="0 0 120 90" fill="none" className="size-full" aria-hidden>
      <ellipse cx="60" cy="78" rx="42" ry="7" fill={TEAL} opacity="0.14" />
      {/* globe */}
      <circle cx="52" cy="40" r="26" fill={TEAL} opacity="0.2" />
      <circle cx="52" cy="40" r="26" stroke={TEAL} strokeWidth="2.5" />
      <ellipse cx="52" cy="40" rx="11" ry="26" stroke={TEAL} strokeWidth="2" />
      <path d="M27 32h50M27 48h50" stroke={TEAL} strokeWidth="2" />
      {/* magnifier */}
      <circle cx="78" cy="52" r="15" fill="var(--card)" opacity="0.9" />
      <circle cx="78" cy="52" r="15" stroke={ORANGE} strokeWidth="3.5" />
      <path d="M89 63l10 10" stroke={ORANGE} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M74 52h8M78 48v8" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function TripsArt() {
  return (
    <svg viewBox="0 0 120 90" fill="none" className="size-full" aria-hidden>
      <ellipse cx="60" cy="78" rx="42" ry="7" fill={TEAL} opacity="0.14" />
      {/* map */}
      <path d="M22 26l24-8 28 8 24-8v46l-24 8-28-8-24 8z" fill={TEAL} opacity="0.18" />
      <path d="M22 26l24-8 28 8 24-8v46l-24 8-28-8-24 8z" stroke={TEAL} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M46 18v46M74 26v46" stroke={TEAL} strokeWidth="2" />
      {/* route */}
      <path d="M36 56c10-6 6-18 18-22s16 6 26 0" stroke={ORANGE} strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" />
      <circle cx="36" cy="56" r="4.5" fill={ORANGE} />
      <circle cx="80" cy="34" r="4.5" fill={ORANGE} />
    </svg>
  );
}

const CARDS = [
  {
    title: "Plan with an expert",
    body: "Get your travel questions answered",
    href: "/#plan",
    Art: ExpertArt,
  },
  {
    title: "Explore",
    body: "See destinations that fit your budget",
    href: "/hotels",
    Art: ExploreArt,
  },
  {
    title: "Trips",
    body: "Keep all your bookings in one place",
    href: "/account/bookings",
    Art: TripsArt,
  },
];

export function TravelProsCards() {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="bg-sidebar py-12 text-sidebar-foreground sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
            For frequent travellers
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-6">
          <CarouselRail ariaLabel="Traveller tools" itemClassName="w-[248px] sm:w-[276px]">
            {CARDS.map(({ title, body, href, Art }) => (
              <Link
                key={title}
                href={href}
                className="group flex h-full flex-col rounded-2xl bg-white p-6 transition-shadow duration-300 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
              >
                <h3 className="font-heading text-base font-bold text-neutral-900">{title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{body}</p>
                <motion.div
                  className="mt-6 h-32 w-full"
                  whileHover={reduced ? undefined : { y: -6, scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  <Art />
                </motion.div>
              </Link>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
