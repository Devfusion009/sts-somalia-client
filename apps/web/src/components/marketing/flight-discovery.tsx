import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headset, Hotel, Plane, Stamp } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import styles from "./premium-travel.module.css";

const DESTINATIONS = [
  { city: "Dubai", country: "United Arab Emirates", code: "DXB", image: "/marketing/dubai.webp" },
  { city: "Nairobi", country: "Kenya", code: "NBO", image: "/marketing/kenya.webp" },
  { city: "Istanbul", country: "Türkiye", code: "IST", image: "/marketing/istanbul.webp" },
];
const MORE_ROUTES = [
  { city: "Jeddah", code: "JED" },
  { city: "Addis Ababa", code: "ADD" },
  { city: "Djibouti", code: "JIB" },
  { city: "Doha", code: "DOH" },
];

export function FlightDiscovery() {
  return (
    <>
      <section id="flight-destinations" aria-labelledby="flight-discovery-title" className={`${styles.discovery} scroll-mt-24`}>
        <div className={styles.container}>
          <div className={styles.sectionTop}>
            <div><span className={styles.sectionKicker}>A change of scenery</span><h2 id="flight-discovery-title" className={styles.sectionTitle}>Where to <em className={styles.serif}>next?</em></h2></div>
            <a href="#flight-search" className={styles.sectionLink}>Explore flights<ArrowUpRight className="size-4" aria-hidden="true" /></a>
          </div>
          <div className={styles.destinationGrid}>
            {DESTINATIONS.map((destination) => <Link key={destination.code} href={`/flights?origin=MGQ&destination=${destination.code}#flight-search`} className={styles.destinationCard}>
              <Image src={destination.image} alt="" fill sizes="(max-width: 767px) 100vw, 38vw" />
              <div className={styles.destinationBody}><span>{destination.country} · {destination.code}</span><div className={styles.destinationBottom}><h3>{destination.city}</h3><span className={styles.roundArrow}><ArrowUpRight className="size-4" aria-hidden="true" /></span></div></div>
            </Link>)}
          </div>
          <div className={styles.routeLinks}><span>More departures from Mogadishu</span>{MORE_ROUTES.map((route) => <Link key={route.code} href={`/flights?origin=MGQ&destination=${route.code}#flight-search`}>{route.city}<ArrowUpRight className="size-3" aria-hidden="true" /></Link>)}</div>
        </div>
      </section>
      <section className={styles.concierge} aria-labelledby="flight-concierge-title">
        <div className={styles.container}>
          <div className={styles.conciergeGrid}>
            <div className={styles.conciergePhoto}><Image src="/marketing/hero-aircraft.webp" alt="An aircraft wing over sunlit clouds" fill sizes="(max-width: 767px) 100vw, 45vw" /></div>
            <div className={styles.conciergeContent}>
              <span className={styles.sectionKicker}>The STS booking desk</span>
              <h2 id="flight-concierge-title" className={styles.sectionTitle}>A real conversation.<br /><em className={styles.serif}>A well-planned journey.</em></h2>
              <div className={styles.conciergeLinks}>
                <a href={whatsappLink("Hello STS! I would like help planning a flight.")} target="_blank" rel="noopener noreferrer"><Headset className="size-4" aria-hidden="true" />Talk to our team<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
                <Link href="/account/bookings"><Plane className="size-4" aria-hidden="true" />My bookings<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                <Link href="/hotels"><Hotel className="size-4" aria-hidden="true" />Find a stay</Link>
                <Link href="/visa"><Stamp className="size-4" aria-hidden="true" />Visa services</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
