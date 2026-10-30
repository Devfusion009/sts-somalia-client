import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, Landmark, Tag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getAllPackages } from "@/modules/umrah/queries";
import { UMRAH_TIERS } from "@/modules/umrah/services";

export const metadata: Metadata = {
  title: "Group Umrah Packages",
  description:
    "Ready-made Umrah packages at a fixed price per person — visa, flights, hotels, transport and guide all included.",
};

const PROMISES = [
  { icon: Tag, title: "One fixed price per person" },
  { icon: CalendarCheck, title: "Scheduled departure dates" },
  { icon: Users, title: "Somali-speaking guide with the group" },
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
          <MarketingBreadcrumb
            tone="dark"
            className="mb-6"
            items={[{ label: "Umrah", href: "/umrah" }, { label: "Group Umrah" }]}
          />

          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              Group Umrah at <span className="text-brand-accent">one fixed price</span>
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-sidebar-foreground/80">
              Packages designed in advance and priced per person, with visa, flights, hotels,
              transport and a guide included.
            </p>
            <ul className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {PROMISES.map((p) => (
                <li key={p.title} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                  <p.icon className="size-4 shrink-0 text-primary" aria-hidden /> {p.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {packages.length === 0 ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Landmark />
              </EmptyMedia>
              <EmptyTitle className="text-base">No group packages published yet</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/umrah/private" />} size="lg" className="gap-2">
                Build a private Umrah <ArrowRight className="size-4" aria-hidden />
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-14">
            {groups.map((group) => (
              <section key={group.tier} aria-labelledby={`tier-${group.tier}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2
                    id={`tier-${group.tier}`}
                    className="font-heading text-xl font-bold tracking-tight sm:text-2xl"
                  >
                    {group.label} packages
                  </h2>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {group.items.length} package{group.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                {group.blurb ? (
                  <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{group.blurb}</p>
                ) : null}
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </section>
            ))}

            {ungrouped.length > 0 ? (
              <section aria-labelledby="tier-more">
                <h2 id="tier-more" className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
                  More packages
                </h2>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {ungrouped.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {packages.length > 0 ? (
          <div className="mt-16 flex flex-col gap-4 rounded-2xl bg-secondary/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">
                None of these dates work for you?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Build a private Umrah on your own dates, with the hotels you choose.
              </p>
            </div>
            <Button
              render={<Link href="/umrah/private" />}
              variant="outline"
              size="lg"
              className="w-full gap-2 bg-card sm:w-auto"
            >
              Build a private trip <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
