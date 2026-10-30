import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, Headset, MapPin, Plane, ShieldCheck, UsersRound } from "lucide-react";
import styles from "./travel-collection.module.css";

export function HotelsCollectionHero({ city, children }: { city: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="hotel-collection-title">
      <div className={styles.hotelIntro}>
        <div className={styles.hotelCanvas}>
          <Image src="/marketing/hotels-panorama.webp" fill priority sizes="(min-width: 1280px) 1216px, 100vw" alt="" className="object-cover object-center" />
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>STS stays</span>
            <h1 id="hotel-collection-title" className={styles.hotelTitle}>{city ? <>Hotels in<br /><span className={styles.editorial}>{city}.</span></> : <>Find your stay.<br /><span className={styles.editorial}>Somalia & beyond.</span></>}</h1>
          </div>
          <span className={styles.photoCaption}><MapPin className="size-3.5" aria-hidden="true" />Dubai, United Arab Emirates</span>
        </div>
        <div className={styles.searchDock}>{children}</div>
        <ul className={styles.trustRow}>
          <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />Card, mobile money & bank transfer</li>
          <li className="flex items-center gap-2"><Headset className="size-4 text-primary" aria-hidden="true" />Somali, English & Arabic support</li>
        </ul>
      </div>
    </section>
  );
}

export function UmrahCollectionHero() {
  return (
    <section className={styles.umrahHero} aria-labelledby="umrah-collection-title">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className={styles.umrahHeroGrid}>
          <div className="relative z-10 py-2">
            <span className={`${styles.kicker} text-white/65`}>Umrah with STS</span>
            <h1 id="umrah-collection-title" className={styles.umrahTitle}>From Somalia.<br />To the <em className={styles.editorial}>Haramain.</em></h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/umrah/group" className="inline-flex min-h-13 items-center justify-center gap-4 rounded-xl bg-[#e8cc91] px-6 text-sm font-semibold text-[#182f28] transition-colors hover:bg-[#f1dbb0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explore group packages<ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="/umrah/private" className="inline-flex min-h-13 items-center justify-center gap-3 rounded-xl border border-white/30 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Build a private trip<ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-9 grid max-w-lg grid-cols-3 gap-3 border-t border-white/15 pt-6 text-[11px] leading-relaxed text-white/75">
              <li><ShieldCheck className="mb-2 size-4 text-[#e8cc91]" aria-hidden="true" />Visa, flights<br />& hotels</li>
              <li><UsersRound className="mb-2 size-4 text-[#e8cc91]" aria-hidden="true" />Group or<br />private travel</li>
              <li><Headset className="mb-2 size-4 text-[#e8cc91]" aria-hidden="true" />Somali-speaking<br />support</li>
            </ul>
            <Link href="#umrah-flows" className="mt-7 inline-flex min-h-10 items-center gap-2 text-[11px] text-white/65 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Find your way to Umrah<ArrowDown className="size-3.5" aria-hidden="true" /></Link>
          </div>
          <div className={styles.umrahVisual}>
            <div className={styles.arch}>
              <Image src="/marketing/madinah.webp" fill priority sizes="(min-width: 1024px) 480px, (min-width: 768px) 45vw, 90vw" alt="The green dome and minarets of Al Masjid an Nabawi in Madinah" className="object-cover" />
              <span className="absolute inset-x-6 bottom-12 z-10 text-center text-[10px] tracking-[.22em] text-white/85 uppercase">Al Madinah Al Munawwarah</span>
            </div>
            <div className={styles.routeTicket} aria-label="Umrah from Somalia to Makkah and Madinah">
              <div><span className="block text-[9px] tracking-widest text-white/50 uppercase">Departure</span><span className="mt-1 block text-sm font-medium">Somalia</span></div>
              <span className="flex flex-1 items-center gap-2 px-2 text-[#e8cc91]" aria-hidden="true"><span className="h-px flex-1 border-t border-dashed border-white/25" /><Plane className="size-4 -rotate-12" /><span className="h-px flex-1 border-t border-dashed border-white/25" /></span>
              <div className="text-right"><span className="block text-[9px] tracking-widest text-white/50 uppercase">Haramain</span><span className="mt-1 block text-sm font-medium">Makkah · Madinah</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
