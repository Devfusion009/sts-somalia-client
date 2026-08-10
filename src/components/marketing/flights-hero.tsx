"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedIcon, FlightTakeoffIcon, MosqueIcon, type SvgIconComponent } from "@/components/ui/mui-icons";
import { cn } from "@/lib/utils";

const MODES: Array<{ key: string; label: string; href: string; icon: SvgIconComponent }> = [
  { key: "flights", label: "Flights", href: "/flights", icon: FlightTakeoffIcon },
  { key: "hotels", label: "Stays", href: "/hotels", icon: BedIcon },
  { key: "umrah", label: "Umrah", href: "/umrah", icon: MosqueIcon },
];

/**
 * Decorative photo collage that fills the hero's right side — overlapping
 * rounded tiles bleeding off the top and right edges, as in the reference.
 * Hidden below lg where the search pill needs the full width.
 */
const COLLAGE = [
  { src: "/marketing/hero-aircraft.webp", className: "right-[26%] top-[-14%] size-44 rounded-full", delay: 0 },
  { src: "/marketing/slide-gulf-city.webp", className: "right-[2%] top-[-6%] size-52 rounded-[2.5rem]", delay: 1.2 },
  { src: "/marketing/airport.webp", className: "right-[30%] top-[46%] size-40 rounded-[2rem]", delay: 2.4 },
  { src: "/marketing/slide-coast.webp", className: "right-[-4%] top-[52%] size-48 rounded-full", delay: 3.6 },
];

export function FlightsHero({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Backdrop photograph. Deliberately a dark, near-empty cloudscape: the
          headline, mode tiles and search pill all sit on top of it, so the
          image has to add depth without competing for attention. */}
      <Image
        src="/marketing/flights-hero-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-95"
      />
      {/* Brand wash over the photo — keeps the band unmistakably STS-dark and
          guarantees white text clears contrast wherever the photo is lightest. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-sidebar/90 via-sidebar/70 to-sidebar/45"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(70%_90%_at_15%_0%,rgba(45,212,180,0.18),transparent),radial-gradient(60%_80%_at_100%_100%,rgba(244,113,28,0.14),transparent)]"
        aria-hidden
      />

      {/* Collage */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[30%] xl:block" aria-hidden>
        {COLLAGE.map((tile) => (
          <div
            key={tile.src}
            style={{ animationDelay: `${tile.delay}s` }}
            className={cn(
              "tile-float absolute overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10",
              tile.className
            )}
          >
            <Image src={tile.src} alt="" fill sizes="220px" className="object-cover" />
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-14 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        <div className="lg:max-w-[72%] xl:max-w-[70%]">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-[2.75rem]">
            Where do you want to go?
          </h1>

          {/* Mode tiles */}
          <div className="mt-7 flex gap-2.5">
            {MODES.map((mode) => {
              const active = pathname.startsWith(mode.href);
              return (
                <Link
                  key={mode.key}
                  href={mode.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-20 flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
                    active
                      ? "bg-brand-accent text-brand-accent-foreground"
                      : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                  )}
                >
                  <mode.icon sx={{ fontSize: 22 }} />
                  {mode.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
