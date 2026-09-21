import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  CreditCard,
  HeartHandshake,
  Headset,
  Lock,
  MessageCircle,
  PackageCheck,
  PackageSearch,
  Plane,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stamp,
  Tag,
  TrainFront,
  UserRoundPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { MosqueIcon } from "@/components/ui/mui-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getFeaturedPackages } from "@/modules/umrah/queries";
import { UMRAH_TIERS } from "@/modules/umrah/services";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Umrah Packages",
  description:
    "Two ways to perform Umrah with STS: join a fixed-price group package, or build a private trip around your own dates, hotels and services.",
};

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Visa, flights & hotels handled end to end" },
  { icon: Users, text: "Experienced Somali-speaking group leaders" },
  { icon: HeartHandshake, text: "Support before, during & after your journey" },
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
  { icon: BadgeCheck, label: "Licensed & Reliable" },
  { icon: Lock, label: "Secure Payments" },
  { icon: Headset, label: "24/7 Support" },
];

const BUILDABLE = [
  { icon: BedDouble, label: "Makkah hotel" },
  { icon: BedDouble, label: "Madinah hotel" },
  { icon: Plane, label: "Flights" },
  { icon: Stamp, label: "Umrah visa" },
  { icon: Users, label: "Ground transport" },
  { icon: TrainFront, label: "Makkah ↔ Madinah" },
  { icon: Sparkles, label: "Extra services" },
];

const COMPARISON: { label: string; group: string; private: string }[] = [
  { label: "Who designs the trip", group: "STS designs it in advance", private: "You build it yourself" },
  { label: "Price", group: "Fixed price per person", private: "Calculated from what you choose" },
  { label: "Travel dates", group: "Set departure dates", private: "Any dates you like" },
  { label: "Hotels", group: "Chosen for the package", private: "You pick each city's hotel" },
  { label: "Services", group: "All included as listed", private: "Add or leave out any service" },
  { label: "Who you travel with", group: "A group, with a guide", private: "Just your own party" },
  { label: "Best for", group: "First-time and value-focused pilgrims", private: "Families, couples and specific needs" },
];

/** The five steps every booking goes through, whichever flow a pilgrim picks. */
const BOOKING_STEPS = [
  {
    icon: PackageSearch,
    title: "Choose your package",
    description: "Pick a group package or build your own trip — set dates, hotel tier and pilgrim count.",
  },
  {
    icon: UserRoundPlus,
    title: "Add pilgrim details",
    description: "Enter each traveller's name and passport details exactly as they'll appear on the visa.",
  },
  {
    icon: CreditCard,
    title: "Pay a deposit or in full",
    description: "A 50% deposit holds your booking. Card, mobile money, bank transfer or agency wallet.",
  },
  {
    icon: Stamp,
    title: "Visa & travel confirmation",
    description: "Track visa processing through to travel-ready on your booking's timeline.",
  },
  {
    icon: MessageCircle,
    title: "Stay in touch",
    description: "WhatsApp and account notifications keep you updated at every stage, up to departure.",
  },
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
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Umrah with STS
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Your journey to the <span className="text-brand-accent">Haramain</span>, taken care of
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              Complete Umrah journeys from Somalia — flights, visas, hotels near the Haram, ground
              transport, and guided ziyarat, arranged by a team that has done this hundreds of
              times. Choose the way you would like to travel.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_POINTS.map((point) => (
                <li key={point.text} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                  <point.icon className="size-4 text-primary" /> {point.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The fork in the road. */}
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground">
            <MosqueIcon sx={{ fontSize: 18 }} /> Two ways to perform Umrah
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Choose the way that suits you
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Join a package we&apos;ve prepared, or create your own trip step by step. Both are
            arranged and operated by the same STS team.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {FLOWS.map((flow) => (
            // The whole card is one link, and the CTA is a styled span rather
            // than a second <a> — nesting an anchor inside an anchor is
            // invalid HTML, and two overlapping links to the same place is one
            // tab stop too many for a keyboard user.
            <Link
              key={flow.href}
              href={flow.href}
              className={cn(
                "group flex flex-col rounded-2xl border border-border bg-card shadow-xs transition-all hover:shadow-lg",
                flow.theme.border
              )}
            >
              <div className="relative h-44 w-full overflow-hidden rounded-t-2xl sm:h-52">
                <Image
                  src={flow.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* The badge straddles the photo's lower edge. It sits in the
                  body (not the image block) because the image block clips its
                  own overflow to keep the top corners rounded. */}
              <div className="relative flex flex-1 flex-col px-6 pb-6">
                <span
                  className={cn(
                    "absolute -top-7 left-6 flex size-14 items-center justify-center rounded-full bg-card shadow-md",
                    flow.theme.badge
                  )}
                >
                  <flow.icon className="size-6" />
                </span>

                <p
                  className={cn(
                    "mt-10 text-xs font-bold tracking-widest uppercase",
                    flow.theme.eyebrow
                  )}
                >
                  {flow.eyebrow}
                </p>
                <h3 className="mt-1.5 font-heading text-2xl font-bold">{flow.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{flow.tagline}</p>

                {/* Two-up until sm: at 390px a four-column split leaves each
                    label ~67px, which breaks "Price updates / as you build"
                    into four ragged lines. Two columns keep it on the two the
                    copy was written for. */}
                <ul className="mt-6 mb-7 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-y-2">
                  {flow.features.map((feature) => (
                    <li key={feature.label.join(" ")} className="flex flex-col items-center text-center">
                      <span
                        className={cn(
                          "flex size-11 items-center justify-center rounded-full",
                          flow.theme.chip
                        )}
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
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="flex items-center justify-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Trusted by thousands of pilgrims worldwide
          </p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {TRUST_STRIP.map((item, i) => (
              <li
                key={item.label}
                className={cn(
                  "flex items-center gap-2",
                  i > 0 && "sm:border-l sm:border-border sm:pl-6"
                )}
              >
                <item.icon className="size-4 text-primary" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* How a booking moves from search to departure — the same five steps
          regardless of which flow above a pilgrim picked. */}
      <div className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              How your booking works
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Five steps from choosing a package to boarding your flight.
            </p>
          </div>

          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {BOOKING_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative flex flex-col items-center rounded-2xl border border-border bg-card px-5 pt-8 pb-6 text-center shadow-xs transition-shadow hover:shadow-md"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span
                  className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary font-heading text-[11px] font-bold text-primary-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* What a private trip is made of — the client's service list, verbatim. */}
      <div className="border-y border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-bold">
                Everything you can choose in a private trip
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick only what you need. The total updates the moment you tick a box.
              </p>
            </div>
            <Button render={<Link href="/umrah/private" />} variant="outline" className="gap-2">
              Start building <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {BUILDABLE.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
              >
                <item.icon className="size-4 text-primary" /> {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-side comparison for anyone still undecided. */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-xl font-bold">Which one is right for me?</h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-3 bg-secondary/60 text-sm font-bold">
            <div className="px-4 py-3" />
            <div className="flex items-center gap-2 border-l border-border px-4 py-3">
              <UsersRound className="size-4 text-primary" /> Group
            </div>
            <div className="flex items-center gap-2 border-l border-border px-4 py-3">
              <Settings2 className="size-4 text-brand-accent" /> Private
            </div>
          </div>
          {COMPARISON.map((row, i) => (
            <div
              key={row.label}
              className={cn("grid grid-cols-3 text-sm", i % 2 === 1 && "bg-muted/40")}
            >
              <div className="px-4 py-3 font-medium text-muted-foreground">{row.label}</div>
              <div className="border-l border-border px-4 py-3">{row.group}</div>
              <div className="border-l border-border px-4 py-3">{row.private}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button render={<Link href="/umrah/group" />} className="gap-2">
            <UsersRound className="size-4" /> Browse group packages
          </Button>
          <Button render={<Link href="/umrah/private" />} variant="outline" className="gap-2">
            <Settings2 className="size-4" /> Build a private trip
          </Button>
        </div>
      </div>

      {/* A taste of the group catalog, so the fixed-price option is concrete. */}
      {featured.length > 0 ? (
        <div className="border-t border-border bg-secondary/20">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Popular group packages</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fixed price per person, available at{" "}
                  {UMRAH_TIERS.map((t) => t.label).join(", ")} standard.
                </p>
              </div>
              <Button render={<Link href="/umrah/group" />} variant="ghost" className="gap-1.5">
                View all <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="size-4 text-primary" />
              Every group package includes visa processing and a guide who travels with the group.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
