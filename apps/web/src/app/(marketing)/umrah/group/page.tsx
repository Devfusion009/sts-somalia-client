import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Home,
  Landmark,
  Settings2,
  Tag,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getAllPackages } from "@/modules/umrah/queries";
import { UMRAH_TIERS } from "@/modules/umrah/services";

export const metadata: Metadata = {
  title: "Group Umrah Packages",
  description:
    "Ready-made Umrah packages at a fixed price per person — visa, flights, hotels, transport and guide all included.",
};

const PROMISES = [
  { icon: Tag, title: "One fixed price per person", text: "What you see is what you pay. Nothing to configure and nothing added later." },
  { icon: CalendarCheck, title: "Dates already scheduled", text: "Depart on a set date with seats held, so you know exactly when you travel." },
  { icon: Users, title: "You travel with a group", text: "A Somali-speaking guide travels with you from departure to return." },
];

/**
 * The GROUP flow: pre-designed packages, fixed price, nothing to assemble.
 *
 * Packages are shown grouped by standard (Basic / Standard / Premium) rather
 * than as one flat price-sorted grid, because the standard IS the decision a
 * customer makes here — the client's brief describes the group product as
 * "Basic / Standard / Premium package, $X per person, here is what's in it".
 * A flat grid buries that choice inside a badge on each card.
 */
export default async function GroupUmrahPage() {
  const packages = await getAllPackages();

  const tierOrder = ["basic", "economy", "standard", "premium", "vip"];
  const groups = tierOrder
    .map((tier) => ({
      tier,
      label: UMRAH_TIERS.find((t) => t.value === tier)?.label ?? tier.charAt(0).toUpperCase() + tier.slice(1),
      blurb: UMRAH_TIERS.find((t) => t.value === tier)?.blurb ?? null,
      items: packages.filter((p) => (p.tier ?? "").toLowerCase() === tier),
    }))
    .filter((g) => g.items.length > 0);

  // Legacy rows may carry a tier outside the ladder above, or none at all.
  // They still have to appear somewhere — a published package that renders
  // nowhere is worse than one in a catch-all section.
  const grouped = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const ungrouped = packages.filter((p) => !grouped.has(p.id));

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
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-sidebar-foreground/70">
            <Link href="/" className="flex items-center gap-1 hover:text-sidebar-foreground">
              <Home className="size-3.5" /> Home
            </Link>
            <ChevronRight className="size-3" />
            <Link href="/umrah" className="hover:text-sidebar-foreground">
              Umrah
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-medium text-sidebar-foreground">Group Umrah</span>
          </nav>

          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Group Umrah
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready-made packages, <span className="text-brand-accent">one fixed price</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              STS designs these packages in advance and prices them per person. Choose the standard
              you want, tell us how many are travelling, and that is your total — there is nothing
              to assemble.
            </p>
            <ul className="mt-7 grid gap-4 sm:grid-cols-3">
              {PROMISES.map((p) => (
                <li key={p.title} className="flex gap-2.5">
                  <p.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-sidebar-foreground/70">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="size-6" />
            </span>
            <h2 className="font-heading text-lg font-semibold">No group packages published yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Our team is preparing the next departures. In the meantime you can build a private
              trip on your own dates.
            </p>
            <Button render={<Link href="/umrah/private" />} className="mt-2 gap-2">
              Build a private Umrah <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <section key={group.tier}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-heading text-xl font-bold">{group.label} packages</h2>
                  <p className="text-sm text-muted-foreground">
                    {group.items.length} package{group.items.length > 1 ? "s" : ""} · fixed price per
                    person
                  </p>
                </div>
                {group.blurb ? (
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{group.blurb}</p>
                ) : null}
                <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </section>
            ))}

            {ungrouped.length > 0 ? (
              <section>
                <h2 className="font-heading text-xl font-bold">More packages</h2>
                <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {ungrouped.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-border bg-secondary/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings2 className="size-5" />
            </span>
            <div>
              <h2 className="font-heading text-base font-bold">
                None of these dates work for you?
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Build a private Umrah instead — your own dates, your own hotels, and a total that
                adds up as you choose.
              </p>
            </div>
          </div>
          <Button render={<Link href="/umrah/private" />} variant="outline" className="gap-2">
            Build a private trip <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
