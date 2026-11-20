import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { NAV_LINKS, PARTNER_LINKS } from "@/lib/nav-links";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import { SocialIcon } from "@/components/ui/social-icons";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { getSocialLinks } from "@/lib/site-settings";

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
const LINK = "inline-flex min-h-9 items-center rounded-sm py-1 text-sm leading-5 text-white/90 transition-colors hover:text-white hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

export async function SiteFooter() {
  const socials = await getSocialLinks();
  return (
    <footer className="bg-[#207f76] text-white">
      <div className="mx-auto max-w-7xl px-5 pt-10 sm:px-6 sm:pt-12 lg:px-8">
        <div className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-4 sm:px-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-white/90" aria-hidden />
          <p className="max-w-5xl text-xs leading-6 text-white/95 sm:text-sm">
            <strong className="font-semibold text-white">Payment safety.</strong>{" "}
            STS only takes payment on this website and at our Mogadishu office. We never ask you to pay through another website, a personal account or a payment link. If in doubt, call{" "}
            <a href={SUPPORT_PHONE_TEL} className="rounded-sm font-semibold whitespace-nowrap underline decoration-white/50 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{SUPPORT_PHONE_DISPLAY}</a>{" "}before you pay.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-10 py-10 sm:grid-cols-2 sm:py-12 lg:grid-cols-[1.3fr_0.85fr_1fr_1fr] lg:gap-x-14">
          <div className="sm:row-span-2 lg:row-span-1">
            <Link href="/" className="inline-flex flex-col items-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <Image src="/logo.png" alt="STS Somalia" width={714} height={312} className="h-9 w-auto brightness-0 invert" />
              <span className="mt-1 text-[8px] font-medium tracking-wide">Scout Travel Solution LTD</span>
            </Link>
            <p className="mt-5 max-w-64 text-sm leading-6 text-white/90">Flights, hotels, visas, Umrah and event halls — from our offices in Mogadishu and Nairobi.</p>
            <Link href="/about#credentials" className="mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border border-white/25 px-3 text-[11px] font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <ShieldCheck className="size-3.5" aria-hidden /> ISO 9001:2015 certified
            </Link>
            <address className="mt-7 space-y-4 border-t border-white/20 pt-6 text-sm leading-6 not-italic text-white/90">
              <div className="flex flex-col items-start">
                <h2 className="mb-2 font-semibold text-white">Contact</h2>
                <a href={SUPPORT_PHONE_TEL} className={`${LINK} block w-fit py-0 font-semibold text-white`}>{SUPPORT_PHONE_DISPLAY}</a>
                <a href="mailto:info@scoutsts.com" className={LINK}>info@scoutsts.com</a>
              </div>
              <div><h3 className="font-semibold text-white">Mogadishu · head office</h3><p>First Floor 111, Sultan Business Park,<br />Waaberi District</p></div>
              <div><h3 className="font-semibold text-white">Nairobi · Kenya office</h3><p>Yare Plaza, 3rd Floor, Office 308,<br />Eastleigh</p></div>
            </address>
          </div>
          {([{ title: "Services", links: NAV_LINKS }, { title: "Company", links: COMPANY_LINKS }, { title: "Help", links: HELP_LINKS }]).map(group => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide">{group.title}</h2>
              <ul className="space-y-1">{group.links.map(link => <li key={link.href}><Link href={link.href} className={LINK}>{link.label}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-1 text-xs leading-5 text-white/85">
            <p>© {new Date().getFullYear()} Scout Travel Solution. All rights reserved.</p>
            <p>Sat–Thu 8:00–18:00 EAT · emergency support 24/7</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Accepted payment methods">
            {["EVC Plus", "Bank transfer", "Visa", "Mastercard"].map(method => <span key={method} role="listitem" className="rounded border border-white/25 px-2 py-1 text-[11px] font-medium text-white/90">{method}</span>)}
          </div>
          {socials.length ? <ul aria-label="Follow STS" className="flex items-center gap-2">{socials.map(social => <li key={social.platform}><a href={social.url} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_PLATFORMS[social.platform].label} className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white hover:text-[#207f76] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><SocialIcon platform={social.platform} size={18} /></a></li>)}</ul> : null}
        </div>
      </div>
    </footer>
  );
}
