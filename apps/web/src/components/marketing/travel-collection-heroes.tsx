import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Headset, MapPin, Plane, ShieldCheck, UsersRound } from "lucide-react";
import styles from "./travel-collection.module.css";
import premium from "./premium-travel.module.css";

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
    <section className={premium.umrahHero} aria-labelledby="umrah-collection-title">
      <Image src="/marketing/editorial/umrah-madinah-twilight.webp" fill preload sizes="100vw" alt="" className={premium.heroImage} />
      <div className={premium.heroShade} />
      <div className={premium.heroInner}>
        <div className={premium.flightCopy}>
          <span className={premium.eyebrow}><span />Umrah with Scout Travel Solution</span>
          <h1 id="umrah-collection-title" className={premium.flightTitle}>Your journey to<br />the <em>Haramain.</em></h1>
          <div className={premium.umrahRoute}>Somalia<span /><Plane className="size-3.5" aria-hidden="true" /><span />Makkah & Madinah</div>
          <div className={premium.heroLinks}>
            <Link href="/umrah/group" className={premium.goldButton}>Explore group packages<ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href="/umrah/private" className={premium.outlineButton}>Build a private trip<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <ul className={premium.umrahFeatures}>
            <li><ShieldCheck className="size-4" aria-hidden="true" />Visa, flights & hotels</li>
            <li><UsersRound className="size-4" aria-hidden="true" />Group & private Umrah</li>
            <li><Headset className="size-4" aria-hidden="true" />Somali-speaking support</li>
          </ul>
        </div>
        <span className={premium.artCaption}><MapPin className="size-3" aria-hidden="true" />Madinah · destination artwork</span>
      </div>
    </section>
  );
}
