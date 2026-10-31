import { ArrowUpRight, ChevronDown, MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Native <details>/<summary> accordion — zero JS, keyboard-accessible out of
 * the box, and the band stays a Server Component. The same Q&A content is
 * emitted as FAQPage JSON-LD.
 */
export const HOME_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "How do I pay for a booking?",
    answer:
      "You can pay with mobile money (EVC Plus), bank transfer or card. The payment options available for your booking are shown at checkout, and every payment gets a digital receipt.",
  },
  {
    question: "Do I need an account to book?",
    answer:
      "You need a free account so your tickets, vouchers and receipts stay in one place and our support team can find your booking instantly when you call. Signing up takes under a minute.",
  },
  {
    question: "Can I cancel or change a booking?",
    answer:
      "It depends on the fare or room you choose — and we show you those rules before you pay, not after. Flexible options are clearly marked, and our desk handles the change or refund process for you.",
  },
  {
    question: "How does visa assistance work?",
    answer:
      "Choose your destination country, and we send you the exact document checklist for your case. Our desk reviews everything before submission, books appointments where needed, and tracks the application until your passport is back.",
  },
  {
    question: "What's included in an Umrah package?",
    answer:
      "Return flights, visa processing, hotels in Makkah and Madinah, airport and inter-city transport, and a group guide. Each package page lists exactly what's included and the distance from your hotel to the Haram.",
  },
  {
    question: "Are hotel rates confirmed?",
    answer:
      "Yes. Partner hotels on STS are vetted and their rates are confirmed, so the price you see at search is the price you pay. If a listing doesn't match what you find on arrival, tell us and we make it right.",
  },
  {
    question: "Can I book for family members or a group?",
    answer:
      "Yes — bookings support named guests, so you can book flights, rooms or an Umrah place for relatives travelling without you. For groups and events, call us and we'll arrange it end to end.",
  },
  {
    question: "What if something goes wrong while I'm travelling?",
    answer:
      "Call or WhatsApp our support line. Booking-related emergencies are answered around the clock, and because we issued your booking, we can act on it directly instead of telling you to 'contact the provider'.",
  },
];

/**
 * Also used on section-specific pages (e.g. visa) with their own `faqs`/
 * `title`/`lead` — the questions travellers ask about that one service are
 * not the same ones they ask about the site overall, so reusing HOME_FAQS
 * everywhere would answer things nobody on that page asked.
 */
export function HomeFaq({
  faqs = HOME_FAQS,
  title = "Frequently asked questions",
  lead,
  homepage = false,
}: {
  faqs?: Array<{ question: string; answer: string }>;
  title?: string;
  lead?: string;
  homepage?: boolean;
} = {}) {
  // Structured data is emitted by the page.
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8", homepage ? "grid max-w-7xl items-start gap-10 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20" : "max-w-3xl")}>
        <Reveal>
          {homepage ? (
            <div>
              <span aria-hidden className="mb-6 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><MessagesSquare className="size-7" strokeWidth={1.5} /></span>
              <h2 className="max-w-sm font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">{title}</h2>
              <Link href="#plan" className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Contact our team <ArrowUpRight className="size-4" aria-hidden /></Link>
            </div>
          ) : <SectionHeading title={title} lead={lead} />}
        </Reveal>

        <Reveal delay={100}>
          <div className={cn(homepage ? "space-y-3" : "mt-12 divide-y divide-border rounded-2xl border border-border bg-card")}>
            {faqs.map((faq) => (
              <details key={faq.question} className={cn("group px-5 py-1 sm:px-6", homepage && "rounded-2xl border border-border bg-card transition-colors hover:border-primary/35 open:border-primary/30 open:bg-primary/5")}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-heading text-base font-semibold marker:hidden focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  {homepage ? (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-primary transition-colors group-open:bg-primary group-open:text-primary-foreground">
                      <Plus className="size-4 transition-transform duration-200 group-open:rotate-45" aria-hidden />
                    </span>
                  ) : <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" aria-hidden />}
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
