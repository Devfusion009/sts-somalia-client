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
 * Right-side photo stack: three rounded-square frames, each backed by a
 * thin offset outline square for depth, bleeding off the top/right edge.
 * Hidden below xl where the search card needs the full width.
 */
const COLLAGE = [
  {
    src: "/marketing/dubai.webp",
    alt: "",
    frame: "right-[-6%] top-[-10%] size-64",
    echo: "right-[-10%] top-[-6%] size-64",
  },
  {
    src: "/marketing/airport.webp",
    alt: "",
    frame: "right-[34%] top-[30%] size-48",
    echo: "right-[30%] top-[34%] size-48",
  },
  {
    src: "/marketing/beach.webp",
    alt: "",
    frame: "right-[-2%] top-[56%] size-56",
    echo: "right-[-6%] top-[60%] size-56",
  },
];

const TRUST_POINTS = [
  { icon: "shield", title: "Fare rules before you pay", detail: "Bags, refunds and changes on every fare" },
  { icon: "badge", title: "IATA-experienced booking team", detail: "Staff who've worked airline reservation desks" },
  { icon: "headset", title: "Support in Somali", detail: "WhatsApp and phone, emergencies around the clock" },
] as const;

function TrustIcon({ kind }: { kind: (typeof TRUST_POINTS)[number]["icon"] }) {
  const paths: Record<string, React.ReactNode> = {
    shield: <path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" />,
    badge: <path d="M12 2l2.4 2.4h3.4v3.4L20.2 10l-2.4 2.4v3.4h-3.4L12 18.2l-2.4-2.4H6.2v-3.4L3.8 10l2.4-2.4V4.2h3.4L12 2z" />,
    headset: <path d="M4 13v-1a8 8 0 0116 0v1M4 13v4a2 2 0 002 2h1v-6H5a1 1 0 00-1 1zm16 0v4a2 2 0 01-2 2h-1v-6h2a1 1 0 011 1z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      {paths[kind]}
    </svg>
  );
}

export function FlightsHero({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="relative isolate overflow-hidden bg-[#04241d] text-white">
      {/* Solid brand-teal canvas with two soft glows — a highlight behind the
          photo stack and a warm one low on the opposite corner. No photo, no
          route lines: the card and the collage carry the imagery. */}
      <div
        className="absolute inset-0 bg-[radial-gradient(60%_75%_at_88%_8%,rgba(45,212,180,0.22),transparent),radial-gradient(50%_65%_at_8%_95%,rgba(244,113,28,0.14),transparent)]"
        aria-hidden
      />

      {/* Collage */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] xl:block" aria-hidden>
        {COLLAGE.map((tile) => (
          <div key={tile.src}>
            <div className={cn("absolute rounded-[2rem] ring-1 ring-white/15", tile.echo)} />
            <div className={cn("absolute overflow-hidden rounded-[2rem] shadow-2xl shadow-black/40 ring-1 ring-white/10", tile.frame)}>
              <Image src={tile.src} alt={tile.alt} fill sizes="260px" className="object-cover" />
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-14 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        <div className="lg:max-w-[72%] xl:max-w-[64%]">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-[2.75rem]">
            Where do you want to go?
          </h1>

          {/* Mode switcher — one segmented pill, not disconnected tiles, so the
              active mode reads as a state change within one control rather
              than three separate buttons competing for weight. */}
          <nav aria-label="Booking type" className="mt-6 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur-sm">
            {MODES.map((mode) => {
              const active = pathname.startsWith(mode.href);
              return (
                <Link
                  key={mode.key}
                  href={mode.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
                    active
                      ? "bg-white text-sidebar shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <mode.icon sx={{ fontSize: 18 }} aria-hidden />
                  {mode.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6">{children}</div>

          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {TRUST_POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-sidebar-primary ring-1 ring-white/15">
                  <TrustIcon kind={point.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{point.title}</span>
                  <span className="block text-xs text-white/60">{point.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
