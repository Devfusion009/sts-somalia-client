import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, Check, Headset, Lock, Plane, Tag, UsersRound } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getFeaturedPackages } from "@/modules/umrah/queries";
import { UmrahBookingJourney, UmrahServiceGallery, UmrahFlowComparison } from "@/components/marketing/umrah-visual-sections";
import { UmrahCollectionHero } from "@/components/marketing/travel-collection-heroes";
import styles from "@/components/marketing/travel-collection.module.css";

export const metadata: Metadata = {
  title: "Umrah Packages",
  description: "Join a fixed-price group Umrah package or build a private trip with your own dates, hotels and services. Umrah from Somalia with STS.",
};

const FLOWS = [
  {
    href: "/umrah/group", title: "Group Umrah", label: "Travel together", image: "/about/umrah-group-wide.webp", icon: UsersRound,
    features: [{ icon: Tag, label: "Fixed package price" }, { icon: CalendarDays, label: "Scheduled departures" }, { icon: Building2, label: "Package hotels" }, { icon: Check, label: "Group guide" }],
    cta: "See group packages",
  },
  {
    href: "/umrah/private", title: "Private Umrah", label: "Travel your way", image: "/marketing/umrah-private.webp", icon: Plane,
    features: [{ icon: CalendarDays, label: "Your travel dates" }, { icon: Building2, label: "Your hotel choices" }, { icon: Plane, label: "Optional flights" }, { icon: UsersRound, label: "Your own party" }],
    cta: "Build a private trip",
  },
];

const TRUST = [
  { icon: BadgeCheck, label: "ISO 9001:2015 certified" },
  { icon: Lock, label: "EVC Plus, bank transfer & card" },
  { icon: Headset, label: "Somali-speaking support" },
];

export default async function UmrahPage() {
  const featured = await getFeaturedPackages(3);
  return (
    <div>
      <UmrahCollectionHero />
      <section id="umrah-flows" aria-labelledby="umrah-flows-heading" className="scroll-mt-28 bg-[#f8f7f2] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><h2 id="umrah-flows-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Your Umrah. <span className={styles.editorial}>Your way.</span></h2><span className="text-xs text-muted-foreground">Group packages & private journeys</span></div>
          <div className="grid gap-5 md:grid-cols-2">
            {FLOWS.map((flow, index) => <Link key={flow.href} href={flow.href} className={styles.flowCard}>
              <div className={styles.flowPhoto}>
                <Image src={flow.image} alt="" fill sizes="(min-width: 1024px) 230px, (min-width: 768px) 45vw, 38vw" className="object-cover" />
                <span className="absolute bottom-5 left-5 z-10 font-heading text-4xl font-light text-white/80">0{index + 1}</span>
              </div>
              <div className={styles.flowBody}>
                <span className="text-[9px] font-semibold tracking-[.16em] text-primary uppercase">{flow.label}</span>
                <h3 className="mt-2 font-heading text-2xl font-semibold tracking-tight">{flow.title}</h3>
                <ul className="mt-6 grid gap-3.5">{flow.features.map((feature) => <li key={feature.label} className="flex items-center gap-2.5 text-xs text-muted-foreground"><feature.icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />{feature.label}</li>)}</ul>
                <span className="mt-6 flex min-h-11 items-center justify-between gap-2 border-t border-border pt-4 text-xs font-semibold text-primary">{flow.cta}<ArrowRight className="size-4" aria-hidden="true" /></span>
              </div>
            </Link>)}
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[11px] text-muted-foreground">{TRUST.map((item) => <li key={item.label} className="flex items-center gap-2"><item.icon className="size-3.5 text-primary" aria-hidden="true" />{item.label}</li>)}</ul>
        </div>
      </section>

      {featured.length > 0 ? <section className="py-14 sm:py-20" aria-label="Featured group packages">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading align="left" title="Find your group package" action={<Link href="/umrah/group" className="inline-flex min-h-11 items-center gap-3 rounded-full border border-border bg-card px-5 text-xs font-semibold hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">All group packages<ArrowRight className="size-4" aria-hidden="true" /></Link>} />
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}</div>
        </div>
      </section> : null}
      <UmrahBookingJourney />
      <UmrahServiceGallery />
      <UmrahFlowComparison />
    </div>
  );
}
