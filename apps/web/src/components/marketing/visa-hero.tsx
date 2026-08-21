import Image from "next/image";

import { FadeIn, StaggerGroup, StaggerItem, SpotlightCard } from "@/components/ui/aceternity/motion-primitives";

import { AccountBalanceIcon, BadgeIcon, DescriptionIcon, EventAvailableIcon, FactCheckIcon, FlightIcon, HealthAndSafetyIcon, HotelIcon, PhotoCameraFrontIcon, TaskAltIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
const STEPS: Array<{ icon: SvgIconComponent; title: string; body: string }> = [
  {
    icon: DescriptionIcon,
    title: "Tell us where you're going",
    body: "We confirm the exact requirements for your passport, your purpose of travel and your destination — not a generic checklist off the internet.",
  },
  {
    icon: FactCheckIcon,
    title: "We prepare and check everything",
    body: "Forms completed, documents reviewed line by line, translations and attestations arranged. Nothing goes in with a paper missing.",
  },
  {
    icon: EventAvailableIcon,
    title: "Appointments and submission",
    body: "We book the biometric or consulate appointment where one is needed and submit on your behalf, with the fees itemised up front.",
  },
  {
    icon: TaskAltIcon,
    title: "Tracked to approval",
    body: "Follow the status online and hear from us the moment anything moves — then collect your passport with the visa inside.",
  },
];

const DOCUMENTS: Array<{ icon: SvgIconComponent; label: string; note: string }> = [
  { icon: BadgeIcon, label: "Passport", note: "Valid 6+ months beyond travel, with blank pages" },
  { icon: PhotoCameraFrontIcon, label: "Photographs", note: "Recent, correct size and background for the consulate" },
  { icon: AccountBalanceIcon, label: "Proof of funds", note: "Bank statements covering the required period" },
  { icon: FlightIcon, label: "Travel itinerary", note: "Confirmed or held flight reservation" },
  { icon: HotelIcon, label: "Accommodation", note: "Hotel booking or a host's invitation letter" },
  { icon: HealthAndSafetyIcon, label: "Insurance", note: "Medical cover where the destination requires it" },
];

/** Hero band for the visa page — flat-lay artwork with the search laid over it. */
export function VisaHeroBanner({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-sidebar">
      <Image
        src="/marketing/visa-desk.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-right"
      />
      {/* Artwork keeps its subject on the left, so the scrim is heaviest there
          and the copy sits over the clean half. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">{children}</div>
    </section>
  );
}

/** Process timeline + document checklist, shown under the visa results. */
export function VisaProcess() {
  return (
    <>
      <section className="bg-muted/40 py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center">
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">How it works</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
              Four steps from application to approval
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Visa refusals are almost always about paperwork, not eligibility. This is the process
              that keeps ours from bouncing.
            </p>
          </FadeIn>

          <ol className="relative mt-12 grid gap-10 lg:grid-cols-4 lg:gap-6">
            <div
              className="absolute top-7 right-[12.5%] left-[12.5%] hidden border-t-2 border-dashed border-border lg:block"
              aria-hidden
            />
            <div className="absolute top-2 bottom-2 left-7 border-l-2 border-dashed border-border lg:hidden" aria-hidden />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <FadeIn delay={i * 0.08} className="flex gap-5 lg:flex-col lg:items-center lg:text-center">
                  <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-8 ring-muted/40">
                    <step.icon sx={{ fontSize: 26 }} />
                  </span>
                  <div>
                    <p className="font-heading text-[11px] font-bold tracking-wider text-primary uppercase">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-0.5 font-heading text-base font-bold">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-background py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">Before you apply</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              What you&rsquo;ll usually need
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Requirements vary by destination and purpose of travel — this is the common core. Pick
              your country above and we&rsquo;ll send the exact list for your case.
            </p>
          </FadeIn>

          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOCUMENTS.map((doc) => (
              <StaggerItem key={doc.label} className="grid">
                <SpotlightCard className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <doc.icon sx={{ fontSize: 22 }} />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold">{doc.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{doc.note}</p>
                  </div>
                </SpotlightCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
    </>
  );
}
