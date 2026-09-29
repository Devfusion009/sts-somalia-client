import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const STEPS: Array<{ title: string; description: string }> = [
  {
    title: "Search",
    description: "Compare flights, hotels, visas, Umrah packages and venues in one place.",
  },
  {
    title: "Choose",
    description: "Pick your option with clear prices, fare rules and cancellation terms up front.",
  },
  {
    title: "Pay your way",
    description: "Mobile money (EVC Plus), bank transfer or card — whatever you already use.",
  },
  {
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
            title="Booked in four steps"
            lead="From first search to boarding pass — designed for first-time online bookers too."
          />
        </Reveal>

        {/* Desktop: horizontal timeline; mobile: vertical with the line on the left. */}
        <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-8">
          <div
            className="absolute top-8 right-[12.5%] left-[12.5%] hidden h-0.5 bg-border lg:block"
            aria-hidden
          />
          <div className="absolute top-2 bottom-2 left-8 w-0.5 bg-border lg:hidden" aria-hidden />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <Reveal delay={i * 80} className="flex gap-5 lg:flex-col lg:items-center lg:text-center">
                <span className="relative z-10 grid size-16 shrink-0 place-items-center rounded-full bg-primary font-heading text-xl font-bold text-primary-foreground ring-8 ring-background">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
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
