import Link from "next/link";
import Image from "next/image";

import { NAV_LINKS, PARTNER_LINKS } from "@/lib/nav-links";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

import { EmailIcon, PhoneInTalkIcon, PlaceIcon } from "@/components/ui/mui-icons";
import { SocialIcon } from "@/components/ui/social-icons";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { getSocialLinks } from "@/lib/site-settings";
const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/account", label: "My Account" },
  { href: "/account/bookings", label: "My bookings" },
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Sign up" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/partner-terms", label: "Partner Terms" },
];

const LINK = "text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none";

export async function SiteFooter() {
  const socials = await getSocialLinks();
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      {/* Contact */}
      <div className="border-b border-sidebar-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:items-center lg:px-8">
          <Link href="/" className="inline-flex w-fit items-center rounded-xl bg-white px-4 py-3 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none">
            <Image src="/logo.png" alt="STS Somalia" width={714} height={312} className="h-12 w-auto sm:h-14" />
          </Link>

          <div>
            <p className="text-sm text-sidebar-foreground/70">Contact our booking desk</p>
            <a href={SUPPORT_PHONE_TEL} className="mt-1 flex w-fit items-center gap-2 rounded font-heading text-xl font-bold tabular-nums hover:text-sidebar-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
              <PhoneInTalkIcon sx={{ fontSize: 20 }} aria-hidden />
              {SUPPORT_PHONE_DISPLAY}
            </a>
            <p className="mt-0.5 text-xs text-sidebar-foreground/60">Sat–Thu 8:00–18:00 EAT · emergencies 24/7</p>
          </div>

          <div className="lg:justify-self-end">
            <p className="mb-2 text-sm font-semibold">Write to our booking desk</p>
            <a href="mailto:info@scoutsts.com" className="inline-flex min-h-11 items-center rounded-lg border border-sidebar-border px-4 text-sm font-semibold hover:bg-white/10">info@scoutsts.com</a>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="max-w-xs text-sm leading-relaxed text-sidebar-foreground/70">
            Scout Travel Solution — flights, hotels, visas, Umrah and event halls, from our offices in
            Mogadishu and Nairobi.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 text-sm text-sidebar-foreground/70">
            <a href="mailto:info@scoutsts.com" className="flex w-fit items-center gap-2 rounded transition-colors hover:text-sidebar-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
              <EmailIcon sx={{ fontSize: 17 }} aria-hidden /> info@scoutsts.com
            </a>
            {/* Both offices, so the footer matches the About page rather than
                implying Mogadishu is the only place we can be reached. */}
            <span className="flex items-start gap-2">
              <PlaceIcon sx={{ fontSize: 17 }} className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium text-sidebar-foreground/70">Mogadishu · head office</span>
                First Floor 111, Sultan Business Park, Waaberi District
              </span>
            </span>
            <span className="flex items-start gap-2">
              <PlaceIcon sx={{ fontSize: 17 }} className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium text-sidebar-foreground/70">Nairobi · Kenya office</span>
                Yare Plaza, 3rd Floor, Office 308, Eastleigh
              </span>
            </span>
          </div>
        </div>

        <nav aria-label="Services">
          <h2 className="text-sm font-semibold">Services</h2>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Partner with us">
          <h2 className="text-sm font-semibold">Partner with us</h2>
          <ul className="mt-4 space-y-2.5">
            {PARTNER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LINK}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="text-sm font-semibold">Company</h2>
          <ul className="mt-4 space-y-2.5">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Social */}
      {socials.length > 0 ? (
        <div className="border-t border-sidebar-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-7 sm:flex-row sm:justify-center sm:px-6 lg:px-8">
            <span className="font-heading text-lg font-bold">Follow us</span>
            <ul className="flex items-center gap-3">
              {socials.map((social) => {
                return (
                  <li key={social.platform}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_PLATFORMS[social.platform].label}
                      className="grid size-11 place-items-center rounded-full bg-white/10 text-sidebar-foreground transition-all duration-200 hover:scale-110 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                    >
                      <SocialIcon platform={social.platform} size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Bottom bar */}
      <div className="border-t border-sidebar-border bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-sidebar-foreground/60 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Scout Travel Solution. All rights reserved.</p>
          <div role="list" className="flex flex-wrap items-center justify-center gap-2" aria-label="Accepted payment methods">
            {["EVC Plus", "Bank transfer", "Visa", "Mastercard"].map((method) => (
              <span key={method} role="listitem" className="rounded-md border border-sidebar-border bg-white/5 px-2.5 py-1 font-medium">
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
