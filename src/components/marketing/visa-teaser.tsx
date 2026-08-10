import { Reveal } from "@/components/marketing/reveal";
import { VisaCountryPicker } from "@/components/marketing/visa-country-picker";

const STEPS = [
  {
    title: "Tell us your destination",
    description: "We confirm exactly which documents, photos and funds proof your application needs.",
  },
  {
    title: "We prepare and check everything",
    description: "Forms filled, documents reviewed, appointments booked — nothing bounces for a missing paper.",
  },
  {
    title: "Track it to approval",
    description: "Follow your application's status online and get your passport back with the visa inside.",
  },
];

/** Inset dark panel (not full-bleed) — variety against the full-width dark bands. */
export function VisaTeaser() {
  return (
    <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-3xl bg-sidebar p-8 text-sidebar-foreground sm:p-10 lg:p-14">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_100%_0%,rgba(45,212,180,0.18),transparent)]" aria-hidden />
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-sidebar-primary uppercase">
                  Visa assistance
                </p>
                <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Visas without the guesswork
                </h2>
                <p className="mt-4 max-w-lg text-lg leading-relaxed text-sidebar-foreground/70">
                  Embassy requirements change constantly and one missing paper costs you weeks. Our
                  visa desk handles hundreds of applications a month — we know what each consulate
                  actually wants.
                </p>
                <ol className="mt-8 space-y-5">
                  {STEPS.map((step, i) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground">
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="font-heading text-base font-semibold">{step.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-sidebar-foreground/70">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <VisaCountryPicker />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
