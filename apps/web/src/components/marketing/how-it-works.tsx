import { CalendarCheck2, CreditCard, Plane, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const STEPS: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Search,
    title: "Search",
    description: "Compare flights, hotels, visas, Umrah packages and venues in one place.",
  },
  {
    icon: CalendarCheck2,
    title: "Choose",
    description: "Pick your option with clear prices, fare rules and cancellation terms up front.",
  },
  {
    icon: CreditCard,
    title: "Pay your way",
    description: "Mobile money (EVC Plus), bank transfer or card — whatever you already use.",
  },
  {
    icon: Plane,
    title: "Travel",
    description: "E-vouchers on WhatsApp and email, with our support desk one call away.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Booked in four steps"
            lead="From first search to boarding pass — designed for first-time online bookers too."
          />
        </Reveal>

        {/* Desktop: horizontal timeline; mobile: vertical with the line on the left. */}
        <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-8">
          <div
            className="absolute top-6 right-[12.5%] left-[12.5%] hidden border-t-2 border-dashed border-border lg:block"
            aria-hidden
          />
          <div className="absolute top-2 bottom-2 left-6 border-l-2 border-dashed border-border lg:hidden" aria-hidden />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <Reveal delay={i * 80} className="flex gap-5 lg:flex-col lg:items-center lg:text-center">
                <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground ring-8 ring-background">
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 font-heading text-lg font-semibold lg:justify-center">
                    <step.icon className="size-4.5 text-primary" aria-hidden />
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
