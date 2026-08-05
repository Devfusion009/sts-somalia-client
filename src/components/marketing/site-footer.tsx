import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { NAV_LINKS, PARTNER_LINKS } from "@/lib/nav-links";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-1">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="STS Somalia" width={714} height={312} className="h-9 w-auto" />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Scout Travel Solution — flights, hotels, visas, Umrah journeys, and
            event halls, booked with confidence.
          </p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
            <a href="tel:+252611444420" className="flex items-center gap-2 hover:text-primary">
              <Phone className="size-4" /> +252 611 444 420
            </a>
            <a href="mailto:support@sts-somalia.example" className="flex items-center gap-2 hover:text-primary">
              <Mail className="size-4" /> support@sts-somalia.example
            </a>
            <span className="flex items-center gap-2">
              <MapPin className="size-4" /> Sultan Business Park, Waaberi District, Muqdisho
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Partner with us</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {PARTNER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/account" className="hover:text-primary">
                My Account
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-primary">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-primary">
                Sign up
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-primary">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-primary">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Scout Travel Solution. All rights reserved.
      </div>
    </footer>
  );
}
