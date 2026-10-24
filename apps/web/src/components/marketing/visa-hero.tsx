import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { countryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { FadeIn, StaggerGroup, StaggerItem, SpotlightCard } from "@/components/ui/aceternity/motion-primitives";
import { SectionHeading } from "@/components/marketing/section-heading";

import { AccountBalanceIcon, BadgeIcon, DescriptionIcon, EventAvailableIcon, FactCheckIcon, FlightIcon, HealthAndSafetyIcon, HotelIcon, PhotoCameraFrontIcon, TaskAltIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
const STEPS: Array<{ icon: SvgIconComponent; title: string; caption: string }> = [
  {
    icon: DescriptionIcon,
    title: "Tell us where you're going",
    caption: "Exact document list for your passport and destination.",
  },
  {
    icon: FactCheckIcon,
    title: "We prepare and check everything",
    caption: "Every document reviewed line by line before submission.",
  },
  {
    icon: EventAvailableIcon,
    title: "Appointments and submission",
    caption: "Biometric appointment booked, fees itemised up front.",
  },
  {
    icon: TaskAltIcon,
    title: "Tracked to approval",
    caption: "Status updates online until your passport is back.",
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

/** Destination photos in the hero collage: source, position/size, country code for the flag chip. */
const COLLAGE_PHOTOS = [
  {
    src: "/marketing/dest-visa-ae.jpg",
    code: "AE",
    delay: 0,
    className: "top-[16%] left-[6%] size-[16rem] rounded-full",
  },
  {
    src: "/marketing/dest-visa-tr.jpg",
    code: "TR",
    delay: 1.4,
    className: "top-[15%] right-[5%] h-[10.5rem] w-[12rem] rounded-[1.75rem]",
  },
  {
    src: "/marketing/dest-visa-sa.jpg",
    code: "SA",
    delay: 2.8,
    className: "top-[55%] right-[7%] h-[12rem] w-[13rem] rounded-[1.75rem]",
  },
];

/** Hero band for the visa page — flat-lay artwork with the search laid over it. */
export function VisaHeroBanner({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative w-full">
      <div className="relative isolate overflow-hidden bg-sidebar">
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

        {/* Floating ribbon, top right — true and short, not a manufactured stat. */}
        <div className="absolute top-4 right-0 z-20">
          <div className="flex items-center gap-2 rounded-l-full bg-primary py-2 pr-6 pl-5 text-xs font-semibold text-primary-foreground shadow-md sm:py-2.5 sm:pr-12 sm:pl-6 sm:text-sm">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            <span>Licensed Somali travel agency</span>
          </div>
        </div>

        {/* Destination collage — hidden below lg where the search pill needs the full width. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] lg:block" aria-hidden>
          {/* Seats the collage on its own dark ground so it reads against the
              desk photo instead of floating over it. */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/25 to-transparent" />
          {/* Warm glow behind the circle, for depth. */}
          <div className="absolute top-[8%] left-[2%] size-[19rem] rounded-full bg-brand-gold/25 blur-[70px]" />

          {COLLAGE_PHOTOS.map((photo) => (
            <div
              key={photo.src}
              style={{ animationDelay: `${photo.delay}s` }}
              className={cn("tile-float absolute", photo.className)}
            >
              <div className="relative size-full overflow-hidden rounded-[inherit] shadow-2xl shadow-black/50 ring-2 ring-white/20">
                <Image src={photo.src} alt="" fill sizes="256px" className="object-cover" />
              </div>
              <span className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full border-2 border-white/90 bg-background text-lg leading-none shadow-md">
                {countryFlag(photo.code)}
              </span>
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:py-24">{children}</div>
      </div>
    </section>
  );
}

/** Step band ("our flow") + document checklist, shown under the visa results. */
export function VisaProcess() {
  return (
    <>
      <section className="border-y border-border bg-secondary/30 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading title="How a visa application works" />
          </FadeIn>

          <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="absolute top-7 right-[12.5%] left-[12.5%] hidden border-t border-dashed border-border lg:block"
              aria-hidden
            />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                <FadeIn delay={i * 0.08} className="flex flex-col items-center">
                  <span
                    className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-background text-primary shadow-sm ring-1 ring-border"
                    aria-hidden
                  >
                    <step.icon sx={{ fontSize: 26 }} />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">
                    {step.caption}
                  </p>
                </FadeIn>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading
              align="left"
              title="What you’ll usually need"
              lead="Requirements vary by destination and purpose of travel. This is the common core."
            />
          </FadeIn>

          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOCUMENTS.map((doc) => (
              <StaggerItem key={doc.label} className="grid">
                <SpotlightCard className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-shadow duration-300 hover:shadow-md">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
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
