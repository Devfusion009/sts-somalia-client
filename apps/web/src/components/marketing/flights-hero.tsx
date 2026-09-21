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
    <section className="relative isolate overflow-hidden bg-[#06372f] text-white">
      {/* Solid brand-teal canvas with the routes STS actually sells: dotted
          great-circle arcs fanning out from Mogadishu. Quiet on purpose — the
          orange origin dot is the only accent. */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1200 560"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden
      >
        <g stroke="white" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 9">
          <path d="M150 470 Q 330 120 620 70" />
          <path d="M150 470 Q 480 210 860 150" />
          <path d="M150 470 Q 560 330 1010 300" />
          <path d="M150 470 Q 260 250 430 170" />
        </g>
        <g fill="white" fillOpacity="0.5">
          <circle cx="620" cy="70" r="3.5" />
          <circle cx="860" cy="150" r="3.5" />
          <circle cx="1010" cy="300" r="3.5" />
          <circle cx="430" cy="170" r="3.5" />
        </g>
        <circle cx="150" cy="470" r="14" fill="#f4711c" fillOpacity="0.25" />
        <circle cx="150" cy="470" r="5" fill="#f4711c" />
      </svg>

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

          {/* Mode switcher — one segmented pill, not disconnected tiles, so the
              active mode reads as a state change within one control rather
              than three separate buttons competing for weight. */}
          <div className="mt-7 inline-flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur-sm">
            {MODES.map((mode) => {
              const active = pathname.startsWith(mode.href);
              return (
                <Link
                  key={mode.key}
                  href={mode.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
                    active
                      ? "bg-white text-sidebar shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <mode.icon sx={{ fontSize: 18 }} />
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
