"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUpRight, Headphones, MapPin, Plane, ShieldCheck, Ticket } from "lucide-react";
import { BedIcon, FlightTakeoffIcon, MosqueIcon, type SvgIconComponent } from "@/components/ui/mui-icons";
import { cn } from "@/lib/utils";
import styles from "./premium-travel.module.css";

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

export function FlightsHero({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <section className={styles.flightSection} aria-labelledby="flights-title">
      <div className={cn(styles.flightHero, compact && styles.compactHero)}>
        <Image src="/marketing/editorial/flights-dubai-dawn.webp" alt="" fill preload sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.flightCopy}>
            <span className={styles.eyebrow}><span />From Somalia. To the world.</span>
            <h1 id="flights-title" className={styles.flightTitle}>{compact ? <>Your next <em>flight.</em></> : <>Good journeys<br />start with a <em>flight.</em></>}</h1>
            {!compact && <div className={styles.heroLinks}>
              <a href="#flight-search" className={styles.goldButton}>Find your flight<ArrowDown className="size-4" aria-hidden="true" /></a>
              <a href="#flight-destinations" className={styles.textLink}>Find your next destination<ArrowUpRight className="size-4" aria-hidden="true" /></a>
            </div>}
          </div>
          {!compact && <Link href="/flights?origin=MGQ&destination=DXB#flight-search" className={styles.heroRoute} aria-label="Find flights from Mogadishu to Dubai">
            <span className={styles.routeKicker}>A new perspective</span>
            <span className={styles.routeCities}><span><small>Mogadishu</small>MGQ</span><Plane className="size-5" aria-hidden="true" /><span><small>Dubai</small>DXB</span><ArrowUpRight className="size-4" aria-hidden="true" /></span>
          </Link>}
          <span className={styles.artCaption}><MapPin className="size-3" aria-hidden="true" />Dubai · destination artwork</span>
        </div>
      </div>
      <div className={styles.bookingWrap}>
        <div id="flight-search" className={styles.bookingDock}>
          <nav aria-label="Booking type" className={styles.bookingNav}>
            {MODES.map((mode) => {
              const active = pathname.startsWith(mode.href);
              return <Link key={mode.href} href={mode.href} aria-current={active ? "page" : undefined} className={cn(styles.bookingTab, active && styles.activeTab)}><mode.icon sx={{ fontSize: 19 }} aria-hidden />{mode.label}</Link>;
            })}
            <span className={styles.bookingBrand}><ShieldCheck className="size-3.5" aria-hidden="true" />Scout Travel Solution</span>
          </nav>
          {children}
        </div>
        <ul className={styles.flightTrust}>{TRUST_POINTS.map((point) => <li key={point.title}><point.icon className="size-[18px]" strokeWidth={1.6} aria-hidden="true" /><span>{point.title}</span></li>)}</ul>
      </div>
    </section>
  );
}
