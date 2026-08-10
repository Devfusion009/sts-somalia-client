import { ChevronDown } from "lucide-react";
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
    question: "Are the hotel photos and prices real?",
    answer:
      "Yes. Partner hotels on STS are vetted, their rates are confirmed, and the price you see at search is the price you pay. If a listing doesn't match reality, tell us and we make it right.",
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

export function HomeFaq() {
  // Structured data is emitted by the page.
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Questions"
            title="Before you ask — you're not the first"
            lead="The answers travellers ask us for most. Anything else, the support desk is one call away."
          />
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
            {HOME_FAQS.map((faq) => (
              <details key={faq.question} className="group px-6 py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-heading text-base font-semibold marker:hidden focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown
                    className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                    aria-hidden
                  />
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
