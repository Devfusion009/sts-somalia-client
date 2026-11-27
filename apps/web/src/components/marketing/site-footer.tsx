import Link from "next/link";
import Image from "next/image";
import { Headphones, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import { NAV_LINKS, PARTNER_LINKS } from "@/lib/nav-links";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import { SocialIcon } from "@/components/ui/social-icons";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { getSocialLinks } from "@/lib/site-settings";
import { OFFICES } from "./about-data";
import { FooterTrustBadges } from "./footer-trust-badges";
import { StsBrandLogo } from "./sts-brand-logo";
import styles from "./site-footer.module.css";

const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/about#credentials", label: "Our credentials" },
  { href: "/about#offices", label: "Our offices" },
  ...PARTNER_LINKS,
];
const HELP_LINKS = [
  { href: "/#plan", label: "Contact our team" },
  { href: "/#faq", label: "Frequently asked questions" },
  { href: "/account", label: "My account" },
  { href: "/account/bookings", label: "My bookings" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/partner-terms", label: "Partner terms" },
];
const PAYMENT_MARKS = [
  { name: "EVC Plus", src: "evc-plus.png", width: 230, height: 128, className: styles.evc },
  { name: "Bank transfer", src: "bank-transfer.png", width: 800, height: 500, className: styles.bank },
  { name: "Visa", src: "visa.png", width: 270, height: 210, className: styles.visa },
  { name: "Mastercard", src: "mastercard.png", width: 999, height: 776, className: styles.mastercard },
];

export async function SiteFooter() {
  const socials = await getSocialLinks();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <section className={styles.invitation} aria-labelledby="footer-invitation">
          <div>
            <span className={styles.eyebrow}>Your next journey, with STS</span>
            <h2 id="footer-invitation">We plan. You explore. <span>We care.</span></h2>
            <p>Flights, stays, visas and Umrah. Speak with our travel team.</p>
          </div>
          <div className={styles.actions}>
            <Link href="/#plan" className={styles.primaryButton}>Plan my trip</Link>
            <a href={SUPPORT_PHONE_TEL} className={styles.secondaryButton}>
              <Phone size={17} aria-hidden /> Call STS
            </a>
          </div>
        </section>

        <div className={styles.navigation}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logoLink}>
              <StsBrandLogo white className={styles.logo} />
            </Link>
            <p>Travel and event services, from our offices in Mogadishu and Nairobi.</p>
            <div className={styles.brandTag}><MapPin size={14} aria-hidden /> Somalia &amp; Kenya</div>
            {socials.length > 0 && (
              <ul aria-label="Follow STS" className={styles.socials}>
                {socials.map(social => (
                  <li key={social.platform}>
                    <a href={social.url} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_PLATFORMS[social.platform].label}>
                      <SocialIcon platform={social.platform} size={19} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {[
            { title: "Explore STS", links: NAV_LINKS },
            { title: "Company & partners", links: COMPANY_LINKS },
            { title: "Help & information", links: HELP_LINKS },
          ].map(group => (
            <nav key={group.title} aria-label={group.title} className={styles.footerNav}>
              <h2 className={styles.navHeading}>{group.title}</h2>
              <ul className={styles.linkList}>
                {group.links.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
              </ul>
            </nav>
          ))}
        </div>

        <section className={styles.offices} aria-label="Contact STS and our offices">
          <div className={styles.travelDesk}>
            <div className={styles.contactHeading}><Headphones size={20} aria-hidden /><h2>Speak with our team</h2></div>
            <a href={SUPPORT_PHONE_TEL} className={styles.deskPhone}>{SUPPORT_PHONE_DISPLAY}</a>
            <a href="mailto:info@scoutsts.com" className={styles.email}><Mail size={15} aria-hidden /> info@scoutsts.com</a>
          </div>
          {OFFICES.map(office => (
            <address key={office.key} className={styles.office}>
              <div className={styles.officeHeading}>
                <MapPin size={18} aria-hidden />
                <h3>{office.city} <span>{office.role}</span></h3>
              </div>
              <p>{office.lines.map(line => <span key={line}>{line}</span>)}</p>
              <div className={styles.officeLinks}>
                <a href={office.phoneTel}>{office.phoneDisplay}</a>
                <a href={office.mapsUrl} target="_blank" rel="noopener noreferrer">View on map</a>
              </div>
            </address>
          ))}
        </section>

        <section className={styles.credentials} aria-labelledby="footer-credentials">
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>Credentials &amp; memberships</span>
            <h2 id="footer-credentials">Our professional<br className={styles.desktopBreak} /> commitments.</h2>
            <Link href="/about#credentials" className={styles.textLink}>View our credentials</Link>
          </div>
          <FooterTrustBadges />
        </section>

        <section className={styles.payments} aria-labelledby="footer-payment-methods">
          <div className={styles.paymentHeading}>
            <span className={styles.iconTile}><ShieldCheck size={23} aria-hidden /></span>
            <h2 id="footer-payment-methods">Accepted<br className={styles.desktopBreak} /> payment methods</h2>
          </div>
          <ul className={styles.paymentMarks}>
            {PAYMENT_MARKS.map(mark => (
              <li key={mark.name}>
                <Image src={`/marketing/payments/${mark.src}`} alt={mark.name} width={mark.width} height={mark.height} unoptimized className={mark.className} />
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.paymentSafety}>
          <ShieldCheck size={20} aria-hidden />
          <p><strong>Payment safety.</strong> Pay only on this website or at our Mogadishu office. STS never requests payment to a personal account or through another website. To confirm a payment request, call <a href={SUPPORT_PHONE_TEL}>{SUPPORT_PHONE_DISPLAY}</a>.</p>
        </div>

        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} Scout Travel Solution. All rights reserved.</p>
          <p>Sat–Thu 8:00–18:00 EAT <span aria-hidden>·</span> Emergency support 24/7</p>
        </div>
      </div>
    </footer>
  );
}
