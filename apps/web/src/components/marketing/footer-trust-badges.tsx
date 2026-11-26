import Link from "next/link";
import { Globe2 } from "lucide-react";

import { CREDENTIALS } from "./about-data";
import styles from "./site-footer.module.css";

// Custom STS seals, rather than reproductions of the accrediting bodies' logos.
const BADGES = [
  { key: "iso-9001", title: "ISO", subtitle: "9001:2015", top: "QUALITY MANAGEMENT", bottom: "CERTIFIED · TQC CERT", caption: "Certified quality system", gold: true },
  { key: "iata-tids", title: "IATA", subtitle: "TIDS", top: "TRAVEL INDUSTRY", bottom: "ACCREDITATION", caption: "IATA TIDS accreditation" },
  { key: "satta", title: "SATTA", subtitle: "MEMBER", top: "SOMALI ASSOCIATION", bottom: "TRAVEL & TOURISM AGENTS", caption: "Somalia travel association" },
  { key: "kata", title: "KATA", subtitle: "MEMBER", top: "KENYA ASSOCIATION", bottom: "TRAVEL AGENTS", caption: "Kenya travel association" },
];

export function FooterTrustBadges() {
  return (
    <ul className={styles.badges}>
      {BADGES.map(badge => {
        const credential = CREDENTIALS.find(item => item.key === badge.key)!;
        const id = `footer-seal-${badge.key}`;

        return (
          <li key={badge.key}>
            <Link href="/about#credentials" className={styles.badgeLink} aria-label={`${credential.label} — view credentials`}>
              <svg viewBox="0 0 144 144" className={`${styles.seal} ${badge.gold ? styles.goldSeal : ""}`} aria-hidden="true" focusable="false">
                <defs>
                  <path id={`${id}-top`} d="M 20,74 A 52,52 0 0,1 124,74" />
                  <path id={`${id}-bottom`} d="M 20,74 A 52,52 0 0,0 124,74" />
                </defs>
                <circle cx="72" cy="72" r="69" className={styles.sealOuter} />
                <circle cx="72" cy="72" r="64" className={styles.sealRing} />
                <circle cx="72" cy="72" r="43" className={styles.sealInner} />
                <text className={styles.sealArc} textAnchor="middle"><textPath href={`#${id}-top`} startOffset="50%">{badge.top}</textPath></text>
                <text className={styles.sealArc} textAnchor="middle"><textPath href={`#${id}-bottom`} startOffset="50%">{badge.bottom}</textPath></text>
                <path d="m 13,71 2,3 3,-2 -1,4 3,2 -4,1 0,4 -3,-3 -3,2 1,-4 -3,-2 4,-1 z M 130,71 l 2,3 3,-2 -1,4 3,2 -4,1 0,4 -3,-3 -3,2 1,-4 -3,-2 4,-1 z" fill="currentColor" />
                <Globe2 x="54" y="34" width="36" height="36" strokeWidth="0.8" className={styles.sealGlobe} />
                <text x="72" y="91" textAnchor="middle" className={styles.sealTitle}>{badge.title}</text>
                <text x="72" y="106" textAnchor="middle" className={styles.sealSubtitle}>{badge.subtitle}</text>
              </svg>
              <span className={styles.badgeCaption}>{badge.caption}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
