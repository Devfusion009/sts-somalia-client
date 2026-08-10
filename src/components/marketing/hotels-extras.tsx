import Link from "next/link";
import { ExpandMoreIcon, FormatQuoteIcon, MapIcon } from "@/components/ui/mui-icons";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/** Static map teaser above the filters, as on the reference results page. */
export function MapCard({ city }: { city: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      {/* Placeholder rather than an embedded map — no maps provider is wired up
          yet, and a fake interactive map would be worse than an honest teaser. */}
      <div
        className="h-32 w-full bg-secondary [background-image:linear-gradient(rgba(0,148,124,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(0,148,124,0.10)_1px,transparent_1px)] [background-size:18px_18px]"
        aria-hidden
      />
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/45 to-transparent">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-4 py-2 font-heading text-sm font-bold text-primary shadow-lg">
          <MapIcon sx={{ fontSize: 17 }} />
          {city ? `${city} on the map` : "Show on map"}
        </span>
      </div>
    </div>
  );
}

export const HOTEL_FAQS = [
  {
    question: "How much does it cost to stay in a hotel in Mogadishu?",
    answer:
      "Guesthouses and simple hotels start around $35–45 a night. Mid-range business hotels sit near $60–90, and the seafront four-star properties run from about $110. Rates rise around Ramadan, Eid and the Umrah season, so book earlier for those weeks.",
  },
  {
    question: "Which hotels are best for a business trip?",
    answer:
      "Look for properties tagged with reliable power, generator backup, Wi-Fi and a meeting room. Our desk can confirm which hotels have a working generator and stable internet before you commit — the amenity list on each property page reflects what we've verified.",
  },
  {
    question: "Do I pay the hotel or STS?",
    answer:
      "You pay STS, and we settle with the property. That means one receipt, one invoice, and a booking we can change or cancel on your behalf under the fare rules shown before you pay.",
  },
  {
    question: "Can I book a hotel for a family member travelling without me?",
    answer:
      "Yes. Bookings support named guests, so you can reserve and pay for a room in someone else's name. We just need their name exactly as it appears on the ID they'll present at check-in.",
  },
  {
    question: "Which hotels are best for families?",
    answer:
      "Filter for properties offering family rooms or connecting rooms. Many Mogadishu and Hargeisa hotels can add a bed to a double room at a small extra charge — ask the desk and we'll arrange it before you arrive.",
  },
  {
    question: "What time is check-in and check-out?",
    answer:
      "Most partner hotels check in from 14:00 and check out by 11:00 or 12:00. Early check-in and late check-out depend on availability; tell us your flight times and we'll request it on the booking.",
  },
];

export function HotelsFaq({ city }: { city?: string }) {
  // JSON-LD for these questions is emitted by the page, per Next's guidance
  // that structured data belongs at page/layout level.
  return (
    <section className="bg-muted/40 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            FAQs about hotels {city ? `in ${city}` : "in Somalia"}
          </h2>
        </FadeIn>

        <FadeIn delay={0.08} className="mt-6 grid gap-x-10 sm:grid-cols-2">
          {HOTEL_FAQS.map((faq) => (
            <details key={faq.question} className="group border-b border-border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-semibold marker:hidden focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ExpandMoreIcon
                  sx={{ fontSize: 20 }}
                  className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}

/**
 * PLACEHOLDER guest quotes — plausible but fictional, initials-only avatars.
 * Replace with real permissioned reviews before launch.
 */
const GUEST_QUOTES = [
  {
    name: "Abdirahman",
    city: "Mogadishu",
    quote:
      "Great city to walk along the seafront in the early evening. The hotel arranged the airport pickup and it was waiting when we landed.",
  },
  {
    name: "Sagal",
    city: "Hargeisa",
    quote:
      "People are welcoming and the food is excellent. Ask for a room away from the street and you'll sleep well.",
  },
  {
    name: "Ibrahim",
    city: "Nairobi",
    quote:
      "Booked through STS for a medical trip. One invoice for the flight and the hotel made the paperwork much easier.",
  },
];

export function GuestVoices({ city }: { city?: string }) {
  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            What guests said about {city || "staying with us"}
          </h2>
        </FadeIn>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {GUEST_QUOTES.map((guest, i) => (
            <FadeIn key={guest.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
                <FormatQuoteIcon sx={{ fontSize: 28 }} className="text-primary/30" />
                <blockquote className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {guest.quote}
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 font-heading text-xs font-bold text-primary">
                      {guest.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <span className="block font-heading text-sm font-bold">{guest.name}</span>
                    <span className="block text-xs text-muted-foreground">{guest.city}</span>
                  </span>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const EXPLORE_LINKS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Hotels in Somalia",
    links: [
      { label: "Mogadishu hotels", href: "/hotels?city=Mogadishu" },
      { label: "Hargeisa hotels", href: "/hotels?city=Hargeisa" },
      { label: "Kismayo hotels", href: "/hotels?city=Kismayo" },
      { label: "Bosaso hotels", href: "/hotels?city=Bosaso" },
      { label: "Garowe hotels", href: "/hotels?city=Garowe" },
    ],
  },
  {
    heading: "Hotels in East Africa",
    links: [
      { label: "Nairobi hotels", href: "/hotels?city=Nairobi" },
      { label: "Addis Ababa hotels", href: "/hotels?city=Addis%20Ababa" },
      { label: "Djibouti hotels", href: "/hotels?city=Djibouti" },
      { label: "Kampala hotels", href: "/hotels?city=Kampala" },
      { label: "Dar es Salaam hotels", href: "/hotels?city=Dar%20es%20Salaam" },
    ],
  },
  {
    heading: "Hotels in the Gulf",
    links: [
      { label: "Dubai hotels", href: "/hotels?city=Dubai" },
      { label: "Jeddah hotels", href: "/hotels?city=Jeddah" },
      { label: "Doha hotels", href: "/hotels?city=Doha" },
      { label: "Riyadh hotels", href: "/hotels?city=Riyadh" },
      { label: "Muscat hotels", href: "/hotels?city=Muscat" },
    ],
  },
  {
    heading: "More ways to travel",
    links: [
      { label: "Book a flight", href: "/flights" },
      { label: "Umrah packages", href: "/umrah" },
      { label: "Visa services", href: "/visa" },
      { label: "Event halls", href: "/events" },
      { label: "List your property", href: "/partners" },
    ],
  },
];

export function ExploreMore() {
  return (
    <section className="border-t border-border bg-muted/40 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-lg font-bold">More places to explore</h2>
        <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLORE_LINKS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-bold">{group.heading}</h3>
              <ul className="mt-2.5 space-y-1.5">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
