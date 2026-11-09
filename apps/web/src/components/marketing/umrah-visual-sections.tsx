import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Camera, Check, ClipboardList, CreditCard, Headset, MapPin, Phone, Plane, UsersRound } from "lucide-react";
import { UmrahPhotoGallery, type UmrahGalleryPhoto } from "./umrah-photo-gallery";
import { whatsappLink } from "@/lib/whatsapp";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import styles from "./premium-travel.module.css";

const PHOTO_ROOT = "/marketing/editorial";
const TRANSPORT: UmrahGalleryPhoto[] = [
  { src: `${PHOTO_ROOT}/umrah-airport.webp`, title: "A welcome on arrival", detail: "Airport transfers", alt: "Pilgrims boarding a coach with their luggage at the airport" },
  { src: `${PHOTO_ROOT}/umrah-coach.webp`, title: "Travel together", detail: "Air-conditioned coaches", alt: "A green and black modern coach from the STS Umrah collection" },
  { src: `${PHOTO_ROOT}/umrah-private-car.webp`, title: "Your own space", detail: "Private cars on request", alt: "A white Toyota private transfer car" },
  { src: `${PHOTO_ROOT}/umrah-intercity.webp`, title: "Makkah to Madinah", detail: "Intercity & Ziyarah journeys", alt: "A brown touring coach used in the Umrah transport gallery" },
];
const HOTELS: UmrahGalleryPhoto[] = [
  { src: `${PHOTO_ROOT}/umrah-room-triple.webp`, title: "Together in comfort", detail: "Triple rooms", alt: "A bright hotel bedroom with three beds" },
  { src: `${PHOTO_ROOT}/umrah-room-view.webp`, title: "A view of Makkah", detail: "Clock-tower views", alt: "Hotel beds beside a window overlooking the Makkah clock tower" },
  { src: `${PHOTO_ROOT}/umrah-room-quad.webp`, title: "Room for the family", detail: "Quadruple rooms", alt: "A hotel room arranged with four beds for a group" },
  { src: `${PHOTO_ROOT}/umrah-lobby.webp`, title: "A place to pause", detail: "Hotel reception & lounge", alt: "The reception and seating area of a hotel in the STS Umrah collection" },
];
const STEPS = [
  { title: "Choose your package", icon: ClipboardList },
  { title: "Add pilgrim details", icon: UsersRound },
  { title: "Deposit or full payment", icon: CreditCard },
  { title: "Visa & travel confirmation", icon: Plane },
  { title: "Stay in touch with STS", icon: Headset },
];

export function UmrahBookingJourney() {
  return (
    <section aria-labelledby="umrah-journey" className={styles.timelineSection}>
      <div className={styles.container}>
        <div className={styles.timelineTop}>
          <div><span className={styles.sectionKicker}>Your Umrah, step by step</span><h2 id="umrah-journey" className={styles.sectionTitle}>From intention <em className={styles.serif}>to departure.</em></h2></div>
          <Link href="/umrah/group" className={styles.outlineButton}>Explore packages<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <ol className={styles.timeline}>{STEPS.map((step, index) => <li key={step.title}><span className={styles.timelineNumber}>0{index + 1}<step.icon className="size-5" strokeWidth={1.3} aria-hidden="true" /></span><h3>{step.title}</h3></li>)}</ol>
      </div>
    </section>
  );
}

export function UmrahServiceGallery() {
  return (
    <>
      <section aria-labelledby="umrah-transport" className={styles.serviceSection}>
        <div className={styles.container}>
          <div className={styles.sectionTop}>
            <div><span className={styles.sectionKicker}>On the ground with STS</span><h2 id="umrah-transport" className={styles.sectionTitle}>From your arrival.<br /><em className={styles.serif}>Through the holy cities.</em></h2></div>
            <span className={styles.serviceMeta}><Camera className="size-3.5" aria-hidden="true" />The STS Umrah photo collection</span>
          </div>
          <UmrahPhotoGallery photos={TRANSPORT} kind="transport" label="Umrah transportation photographs" />
          <div className={styles.serviceNote}><span>Airport transfers · Makkah ↔ Madinah · Ziyarah · Private cars</span><Link href="/umrah/private#service-transport">Explore transport options<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div>
        </div>
      </section>
      <section aria-labelledby="umrah-hotels" className={styles.serviceSection}>
        <div className={styles.container}>
          <div className={styles.sectionTop}>
            <div><span className={styles.sectionKicker}>Stays in Makkah & Madinah</span><h2 id="umrah-hotels" className={styles.sectionTitle}>Rest, <em className={styles.serif}>close to the Haram.</em></h2></div>
            <Link href="/umrah/private#service-hotel_makkah" className={styles.sectionLink}>Explore hotel options<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <UmrahPhotoGallery photos={HOTELS} kind="hotels" label="Umrah hotel photographs" />
          <div className={styles.serviceNote}><span>From the STS hotel collection</span><Link href="/umrah/group">View package hotels<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div>
        </div>
      </section>
    </>
  );
}

export function UmrahSupportSection() {
  return (
    <section aria-labelledby="umrah-support-title" className={styles.supportSection}>
      <div className={styles.container}>
        <div className={styles.supportGrid}>
          <div className={styles.supportPhoto}><Image src="/about/umrah-group-wide.webp" alt="An STS Umrah group gathered during their pilgrimage" fill sizes="(max-width: 767px) 100vw, 55vw" /><span>Moments from our Umrah journeys</span></div>
          <div>
            <span className={styles.sectionKicker}>People you can speak to</span>
            <h2 id="umrah-support-title" className={styles.sectionTitle}>Your questions.<br /><em className={styles.serif}>Our Umrah team.</em></h2>
            <div className={styles.supportContacts}><a href={whatsappLink("Hello STS! I would like to discuss an Umrah journey.")} target="_blank" rel="noopener noreferrer" className={styles.goldButton}>Speak to an Umrah specialist<ArrowUpRight className="size-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><a href={SUPPORT_PHONE_TEL} className={styles.supportPhone}><Phone className="size-3.5" aria-hidden="true" />{SUPPORT_PHONE_DISPLAY}</a></div>
            <ul className={styles.supportFacts}>
              <li><Headset className="size-4" aria-hidden="true" />Somali-speaking support</li>
              <li><MapPin className="size-4" aria-hidden="true" />Offices in Mogadishu & Nairobi</li>
              <li><BadgeCheck className="size-4" aria-hidden="true" />ISO 9001:2015 certified</li>
              <li><Check className="size-4" aria-hidden="true" />Group packages & private journeys</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
