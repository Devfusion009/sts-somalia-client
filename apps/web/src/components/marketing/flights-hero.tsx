"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Headphones, Plane, ShieldCheck, Ticket } from "lucide-react";
import { BedIcon, FlightTakeoffIcon, MosqueIcon, type SvgIconComponent } from "@/components/ui/mui-icons";
import { cn } from "@/lib/utils";

const MODES: Array<{ label: string; href: string; icon: SvgIconComponent }> = [
  { label: "Flights", href: "/flights", icon: FlightTakeoffIcon },
  { label: "Stays", href: "/hotels", icon: BedIcon },
  { label: "Umrah", href: "/umrah", icon: MosqueIcon },
];

const TRUST_POINTS = [
  { icon: ShieldCheck, title: "ISO-certified company" },
  { icon: Ticket, title: "IATA-experienced booking team" },
  { icon: Headphones, title: "Support in Somali" },
];

export function FlightsHero({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="relative isolate bg-[#f3f7f5]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[calc(100%-10rem)] overflow-hidden bg-[#073c34] sm:h-[calc(100%-6rem)]" aria-hidden="true">
        <div className="absolute -top-64 -left-48 size-[650px] rounded-full border border-white/[0.06]" />
        <div className="absolute -top-40 -left-24 size-[650px] rounded-full border border-white/[0.06]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,#176658_0%,transparent_65%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-9 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="pb-2 lg:pb-5">
            <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#a7d7c9] uppercase">
              <span className="h-px w-8 bg-[#eaa16f]" aria-hidden="true" />
              From Somalia. To the world.
            </div>
            <h1 className="font-heading text-[2.65rem] leading-[1.06] font-semibold tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.25rem]">
              A new view.<br />
              <span className="text-[#a8dec9]">A flight away.</span>
            </h1>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-white/80">
              <span className="flex items-center gap-2"><Plane className="size-4 text-[#eaa16f]" aria-hidden="true" /> Domestic & international flights</span>
              <span className="hidden h-3 w-px bg-white/25 sm:block" aria-hidden="true" />
              <a href="#flight-destinations" className="inline-flex min-h-9 items-center gap-1.5 rounded-sm text-white underline decoration-white/35 underline-offset-4 transition-colors hover:text-[#a8dec9] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explore destinations <ArrowUpRight className="size-4" aria-hidden="true" /></a>
            </div>
          </div>

          <div className="relative hidden pb-5 lg:block">
            <div className="relative h-[272px] overflow-hidden rounded-[1.5rem] rounded-tr-[5rem] border border-white/15">
              <Image src="/marketing/hero-aircraft.webp" alt="An aircraft wing above the clouds at sunset" fill preload sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-[#06372f]/60 via-transparent to-transparent" />
              <span className="absolute top-5 left-5 rounded-full border border-white/30 bg-[#073c34]/40 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-white uppercase backdrop-blur-md">The window seat awaits</span>
            </div>
            <Link href="/flights?origin=MGQ&destination=DXB#flight-search" className="group absolute -bottom-1 -left-6 flex w-[290px] items-center gap-5 rounded-2xl border border-white/20 bg-[#f9fbf7] px-5 py-4 text-[#123d33] shadow-xl transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <div><span className="block text-[10px] font-medium text-[#5a7168]">Mogadishu</span><span className="font-heading text-2xl font-bold tracking-tight">MGQ</span></div>
              <div className="flex flex-1 items-center gap-2 text-[#00947c]" aria-hidden="true"><span className="h-px flex-1 bg-[#cadbd2]" /><Plane className="size-4" /><span className="h-px flex-1 bg-[#cadbd2]" /></div>
              <div><span className="block text-[10px] font-medium text-[#5a7168]">Dubai</span><span className="font-heading text-2xl font-bold tracking-tight">DXB</span></div>
              <ArrowUpRight className="size-4 text-[#00947c] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div id="flight-search" className="relative mt-7 scroll-mt-28 rounded-[1.5rem] bg-card text-card-foreground shadow-[0_20px_65px_-25px_rgba(5,48,37,0.3)] ring-1 ring-black/5 sm:mt-9">
          <nav aria-label="Booking type" className="flex items-center gap-5 border-b border-border px-5 sm:gap-7 sm:px-7">
            {MODES.map((mode) => {
              const active = pathname.startsWith(mode.href);
              return (
                <Link key={mode.href} href={mode.href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-16 items-center gap-2 px-1 text-sm font-semibold transition-colors focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", active ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary" : "text-muted-foreground hover:text-primary")}>
                  <mode.icon sx={{ fontSize: 19 }} aria-hidden />{mode.label}
                </Link>
              );
            })}
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><ShieldCheck className="size-3.5 text-primary" aria-hidden="true" /> STS Travel & Tours</span>
          </nav>
          {children}
        </div>

        <ul className="grid gap-4 py-7 sm:grid-cols-3 sm:gap-6 sm:py-8">
          {TRUST_POINTS.map((point) => (
            <li key={point.title} className="flex items-center gap-3 sm:justify-center">
              <point.icon className="size-[18px] shrink-0 text-[#00816c]" strokeWidth={1.6} aria-hidden="true" />
              <span className="text-xs font-medium text-[#405d53] sm:text-[13px]">{point.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
