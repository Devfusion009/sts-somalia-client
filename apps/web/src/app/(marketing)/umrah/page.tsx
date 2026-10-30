import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  HeartHandshake,
  Headset,
  Lock,
  PackageCheck,
  Plane,
  Settings2,
  ShieldCheck,
  Tag,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getFeaturedPackages } from "@/modules/umrah/queries";
import { UMRAH_TIERS } from "@/modules/umrah/services";
import { UmrahBookingJourney, UmrahServiceGallery, UmrahFlowComparison } from "@/components/marketing/umrah-visual-sections";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Umrah Packages",
  description:
    "Two ways to perform Umrah with STS: join a fixed-price group package, or build a private trip around your own dates, hotels and services.",
};

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Visa, flights and hotels handled end to end" },
  { icon: Users, text: "Experienced Somali-speaking group leaders" },
  { icon: HeartHandshake, text: "Support before, during and after travel" },
];

/**
 * The two flows, side by side. This page exists because the client's brief
 * asks for exactly one thing above all else: that a customer arriving at
 * Umrah can tell, immediately and without reading a paragraph, which of the
 * two products they want. Everything below is in service of that single
 * decision — the packages grid that used to live at this URL moved to
 * /umrah/group, where it belongs to one of the two answers rather than being
 * mistaken for the whole offer.
 */
const FLOWS = [
  {
    href: "/umrah/group",
    eyebrow: "Option 1",
    title: "Group Umrah",
    tagline: "A ready-made package at a fixed price.",
    image: "/about/umrah-group.webp",
    icon: UsersRound,
    // Four claims, four icons, two lines each. The long paragraph and the
    // four full-sentence bullets this replaced said the same things, but a
    // customer choosing between two products scans — they do not read two
    // columns of prose to find the one difference that matters to them.
    features: [
      { icon: PackageCheck, label: ["Everything", "included"] },
      { icon: Tag, label: ["Fixed price", "per person"] },
      { icon: CalendarDays, label: ["Scheduled", "departures"] },
      { icon: CircleCheck, label: ["Nothing to", "configure"] },
    ],
    cta: "See group packages",
    // Each flow owns its colour end to end — eyebrow, icon chips and CTA —
    // so the two cards read as two products rather than one design with a
    // different photograph. Green is the platform primary; orange is the
    // brand accent already used for "build/act" affordances site-wide.
    theme: {
      eyebrow: "text-primary",
      chip: "bg-primary/10 text-primary",
      badge: "text-primary",
      cta: "bg-primary text-primary-foreground hover:bg-primary/90",
      border: "hover:border-primary/40",
    },
  },
  {
    href: "/umrah/private",
    eyebrow: "Option 2",
    title: "Individual / Private Umrah",
    tagline: "Build your own trip, service by service.",
    // A small party of pilgrims in ihram, alone in an empty courtyard — the
    // literal picture of "one traveller, a couple, a family or a small party",
    // and the deliberate opposite of the crowd on the Group card. It replaces
    // /about/umrah-team.webp, an about-us staff photo of four identifiable
    // men, which on a product card read as "these are your fellow travellers".
    image: "/marketing/umrah-private.webp",
    icon: Settings2,
    features: [
      { icon: CalendarDays, label: ["Your dates,", "your nights"] },
      { icon: Building2, label: ["Choose your", "hotels"] },
      { icon: Plane, label: ["Add flights,", "visa & more"] },
      { icon: CircleDollarSign, label: ["Price updates", "as you build"] },
    ],
    cta: "Build a private trip",
    theme: {
      eyebrow: "text-brand-accent",
      chip: "bg-brand-accent/10 text-brand-accent",
      badge: "text-brand-accent",
      cta: "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
      border: "hover:border-brand-accent/40",
    },
  },
];

/** Reassurance under the fork, for the visitor still hesitating between them. */
const TRUST_STRIP = [
  { icon: BadgeCheck, label: "ISO 9001:2015 certified" },
  { icon: Lock, label: "EVC Plus, bank transfer or card" },
  { icon: Headset, label: "24/7 support in Somali" },
];

export default async function UmrahPage() {
  const featured = await getFeaturedPackages(3);

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
        <Image
          src="/marketing/umrah-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center lg:object-right"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/70 lg:via-sidebar/85 lg:to-sidebar/35"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              Umrah from Somalia to the <span className="text-brand-accent">Haramain</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-sidebar-foreground/80">
              Flights, visas, hotels near the Haram, ground transport and guided ziyarat — as a
              fixed-price group package or a private trip you build yourself.
            </p>
            <ul className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {TRUST_POINTS.map((point) => (
                <li key={point.text} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                  <point.icon className="size-4 shrink-0 text-primary" aria-hidden /> {point.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The fork in the road. */}
      <section aria-labelledby="umrah-flows" className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div id="umrah-flows">
            <SectionHeading
              title="Two ways to perform Umrah"
              lead="Join a package we have prepared, or build your own trip. Both are operated by the same STS team."
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {FLOWS.map((flow) => (
              // The whole card is one link; the CTA is a styled span, not a
              // nested <a>.
              <Link
                key={flow.href}
                href={flow.href}
                className={cn(
                  "group flex flex-col rounded-2xl border border-border bg-card shadow-xs transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  flow.theme.border
                )}
              >
                <div className="relative h-44 w-full overflow-hidden rounded-t-2xl sm:h-52">
                  <Image
                    src={flow.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  />
                </div>

                {/* The badge straddles the photo's lower edge; it sits in the
                    body because the image block clips its own overflow. */}
                <div className="relative flex flex-1 flex-col px-5 pb-6 sm:px-6">
                  <span
                    className={cn(
                      "absolute -top-7 left-5 flex size-14 items-center justify-center rounded-full bg-card shadow-md sm:left-6",
                      flow.theme.badge
                    )}
                    aria-hidden
                  >
                    <flow.icon className="size-6" />
                  </span>

                  <p className={cn("mt-10 text-xs font-bold", flow.theme.eyebrow)}>{flow.eyebrow}</p>
                  <h3 className="mt-1.5 font-heading text-2xl font-bold tracking-tight">{flow.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{flow.tagline}</p>

                  {/* Two-up until sm so each two-line label keeps its two lines at 390px. */}
                  <ul className="mt-6 mb-7 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-y-2">
                    {flow.features.map((feature) => (
                      <li key={feature.label.join(" ")} className="flex flex-col items-center text-center">
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-full",
                            flow.theme.chip
                          )}
                          aria-hidden
                        >
                          <feature.icon className="size-5" />
                        </span>
                        <span className="mt-2 text-xs leading-snug text-muted-foreground">
                          {feature.label[0]}
                          <br />
                          {feature.label[1]}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <span
                    className={cn(
                      "mt-auto flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
                      flow.theme.cta
                    )}
                  >
                    {flow.cta}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <ul className="mt-10 flex flex-col items-center gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
            {TRUST_STRIP.map((item, i) => (
              <li
                key={item.label}
                className={cn("flex items-center gap-2", i > 0 && "sm:border-l sm:border-border sm:pl-6")}
              >
                <item.icon className="size-4 text-primary" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <UmrahBookingJourney />
      <UmrahServiceGallery />
      <UmrahFlowComparison />

      {/* A taste of the group catalog, so the fixed-price option is concrete. */}
      {featured.length > 0 ? (
        <section className="border-t border-border bg-secondary/20 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              align="left"
              title="Group packages"
              lead={`Fixed price per person, at ${UMRAH_TIERS.map((t) => t.label).join(", ")} standard. Visa processing and a travelling guide are included.`}
              action={
                <Button
                  render={<Link href="/umrah/group" />}
                 
                  variant="outline"
                  size="lg"
                  className="gap-1.5"
                >
                  View all <ArrowRight className="size-4" aria-hidden />
                </Button>
              }
            />
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
