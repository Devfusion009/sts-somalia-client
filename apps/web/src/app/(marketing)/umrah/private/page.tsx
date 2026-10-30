import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowRight, CalendarDays, Calculator, Hash, UsersRound } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth/session";
import {
  getMyDraftUmrahRequest,
  getUmrahServices,
  getUmrahSharingPrices,
} from "@/modules/umrah/custom-queries";
import { startUmrahCustomRequest } from "@/modules/umrah/custom-actions";
import { UMRAH_CATEGORIES, UMRAH_TIERS, UMRAH_TIER_LABELS, PRICE_UNIT_LABELS } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays } from "@/modules/umrah/pricing";

export const metadata: Metadata = {
  title: "Private Umrah — build your own",
  description:
    "Build an Umrah trip around your own dates: choose your Makkah and Madinah hotels, flights, visa, transport and extras, and see the total as you go.",
};

const STEPS = [
  { n: 1, title: "Your trip", text: "Travellers, departure date, and how many nights in each city." },
  { n: 2, title: "Choose your services", text: "Hotels, flights, visa, transport and extras — the total updates as you pick." },
  { n: 3, title: "Traveller details", text: "Passport details for everyone travelling with you." },
  { n: 4, title: "Review & submit", text: "See the full breakdown, then send it to our team." },
];

/**
 * The private flow's front door. Its job is to make the "system calculates
 * the total" promise credible BEFORE anyone signs in — hence the live
 * "from" prices pulled straight from the catalog rather than a static
 * marketing figure that drifts the first time STS reprices anything.
 */
export default async function PrivateUmrahPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser("/umrah/private");
  const [{ error }, services, sharingPrices, draft] = await Promise.all([
    searchParams,
    getUmrahServices(),
    getUmrahSharingPrices(),
    getMyDraftUmrahRequest(),
  ]);

  const cheapestByCategory = new Map<string, { price: number; currency: string; unit: string }>();
  for (const service of services) {
    const current = cheapestByCategory.get(service.category);
    // A hotel's "from" price is its lowest occupancy price, when it has any.
    const lowest = Math.min(service.price, ...Object.values(sharingPrices[service.id] ?? {}));
    if (!current || lowest < current.price) {
      cheapestByCategory.set(service.category, {
        price: lowest,
        currency: service.currency,
        unit: PRICE_UNIT_LABELS[service.price_unit],
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MarketingBreadcrumb
        className="mb-4"
        items={[{ label: "Umrah", href: "/umrah" }, { label: "Private Umrah" }]}
      />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertDescription>Couldn&apos;t start your trip. Try again.</AlertDescription>
        </Alert>
      ) : null}

      <section className="relative overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
        {/* A single figure alone in a wide, sunlit courtyard — this page is
            about travelling on your own terms, not with a group, and the
            about-us team photo that was here said the opposite. Chosen over
            the dusk shots for composition as much as subject: the copy column
            sits on the left, so the photograph has to keep its interest (the
            arcade, the minaret, the walking figure) to the RIGHT of it, and be
            bright enough to survive the scrim. */}
        <Image
          src="/marketing/umrah-private-courtyard.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Heavy on the left where the headline sits, clearing towards the
            arcade so the photograph still reads as a photograph — the same
            treatment as the /umrah and /umrah/group heroes. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/70 lg:via-sidebar/85 lg:to-sidebar/35"
          aria-hidden
        />
        <div className="relative z-10 px-5 py-12 sm:px-10 lg:py-16">
          <div className="max-w-2xl">
            {draft ? (
              // The whole reason a draft is looked up on this page: someone
              // who abandoned the builder mid-way and comes back later must
              // see, immediately, that there's something to pick back up —
              // not the exact same first-time pitch, which reads as "start
              // over" even though nothing was lost.
              <>
                <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Welcome back — pick up where you left off
                </h1>
                <dl className="mt-5 flex flex-col gap-2 text-sm text-sidebar-foreground/80 sm:flex-row sm:flex-wrap sm:gap-x-6">
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Travellers</dt>
                    <UsersRound className="size-4 text-brand-accent" aria-hidden />
                    <dd>
                      {UMRAH_TIER_LABELS[draft.tier]} · {draft.num_pilgrims} traveller
                      {draft.num_pilgrims > 1 ? "s" : ""}
                    </dd>
                  </div>
                  {draft.nights_makkah + draft.nights_madinah > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Duration</dt>
                      <CalendarDays className="size-4 text-brand-accent" aria-hidden />
                      <dd className="tabular-nums">
                        {tripDurationDays({
                          numPilgrims: draft.num_pilgrims,
                          nightsMakkah: draft.nights_makkah,
                          nightsMadinah: draft.nights_madinah,
                        })}{" "}
                        days
                      </dd>
                    </div>
                  ) : null}
                  {draft.subtotal > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Total so far</dt>
                      <Calculator className="size-4 text-brand-accent" aria-hidden />
                      <dd className="tabular-nums">{formatMoney(draft.subtotal, draft.currency)} so far</dd>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Reference</dt>
                    <Hash className="size-4 text-brand-accent" aria-hidden />
                    <dd className="font-mono text-xs">{draft.reference}</dd>
                  </div>
                </dl>
                <Button
                  render={<Link href={`/umrah/private/${draft.id}?step=${draft.current_step}`} />}
                  size="lg"
                  className="mt-7 w-full gap-2 sm:w-auto"
                >
                  Resume your trip <ArrowRight className="size-4" aria-hidden />
                </Button>
              </>
            ) : (
              <>
                <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Build your own Umrah
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-sidebar-foreground/80">
                  For one traveller, a couple, a family or a small party. Choose your Makkah and
                  Madinah hotels, flights, visa, transport and extras, and see the total as you go.
                </p>
                <form action={startUmrahCustomRequest} className="mt-7">
                  <SubmitButton size="lg" pendingText="Setting up your trip…" className="w-full gap-2 sm:w-auto">
                    Start building <ArrowRight className="size-4" aria-hidden />
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="private-steps">
            <h2 id="private-steps" className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
              How it works
            </h2>
            <ol className="mt-5 space-y-5">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground tabular-nums"
                    aria-hidden
                  >
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-semibold">
                      <span className="sr-only">Step {step.n}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="private-pricing" className="rounded-xl bg-secondary/40 p-5 sm:p-6">
            <h2 id="private-pricing" className="font-heading text-base font-bold">
              How the price is worked out
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every service has its own rate and its own unit — hotels are per person per night,
              flights and visas are per person, and a private car is one price for your whole party.
            </p>
            <p className="mt-3 rounded-lg bg-card px-4 py-3 font-mono text-xs leading-relaxed">
              Flight + Visa + Makkah hotel + Madinah hotel + Transport + Train + VIP service ={" "}
              <span className="font-bold text-primary">Total Umrah price</span>
            </p>
          </section>

          <section
            aria-labelledby="private-group"
            className="flex flex-col gap-4 rounded-xl border border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div>
              <h2 id="private-group" className="font-heading text-base font-bold">
                Prefer a ready-made package?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Group packages at a fixed price per person — {UMRAH_TIERS.map((t) => t.label).join(", ")}.
              </p>
            </div>
            <Button
              render={<Link href="/umrah/group" />}
              variant="outline"
              size="lg"
              className="w-full shrink-0 gap-1.5 sm:w-auto"
            >
              See group packages <ArrowRight className="size-4" aria-hidden />
            </Button>
          </section>
        </div>

        <aside aria-labelledby="private-choices">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs lg:sticky lg:top-24">
            <h2 id="private-choices" className="font-heading text-base font-bold">
              What you can choose
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {UMRAH_CATEGORIES.map((category) => {
                const from = cheapestByCategory.get(category.value);
                return (
                  <li key={category.value} id={`service-${category.value}`} className="flex scroll-mt-32 items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <category.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{category.label}</p>
                      <p className="text-xs text-muted-foreground">{category.hint}</p>
                    </div>
                    {from ? (
                      <p className="shrink-0 text-right text-xs tabular-nums">
                        <span className="block text-muted-foreground">from</span>
                        <span className="font-semibold text-foreground">
                          {formatMoney(from.price, from.currency)}
                        </span>
                        <span className="block text-muted-foreground">{from.unit}</span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {services.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                This season&apos;s rates are being finalised. Start a trip and our team will send prices.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
