import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Calculator,
  Home,
  ListChecks,
  RotateCcw,
  Settings2,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentProfile } from "@/lib/auth/session";
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
  const [{ error }, services, sharingPrices, profile] = await Promise.all([
    searchParams,
    getUmrahServices(),
    getUmrahSharingPrices(),
    getCurrentProfile(),
  ]);
  // Only a signed-in visitor can have a draft at all (starting one requires
  // an account), so this is skipped entirely for a signed-out visitor rather
  // than costing them a query that can never return anything.
  const draft = profile ? await getMyDraftUmrahRequest() : null;

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
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/umrah" className="hover:text-foreground">
          Umrah
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">Private Umrah</span>
      </nav>

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertDescription>
            We couldn&apos;t start your trip just now. Please try again.
          </AlertDescription>
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
        <div className="relative z-10 px-6 py-12 sm:px-10 lg:py-16">
          <div className="max-w-2xl">
            {draft ? (
              // The whole reason a draft is looked up on this page: someone
              // who abandoned the builder mid-way and comes back later must
              // see, immediately, that there's something to pick back up —
              // not the exact same first-time pitch, which reads as "start
              // over" even though nothing was lost.
              <>
                <Badge className="border-transparent bg-brand-accent/20 text-sidebar-foreground">
                  <RotateCcw className="size-3.5" /> Trip in progress
                </Badge>
                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  Welcome back — pick up where you left off
                </h1>
                <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
                  Your {UMRAH_TIER_LABELS[draft.tier]} trip for {draft.num_pilgrims} traveller
                  {draft.num_pilgrims > 1 ? "s" : ""} is saved — nothing has been lost.
                </p>
                <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sidebar-foreground/80">
                  <div className="flex items-center gap-1.5">
                    <UsersRound className="size-4 text-brand-accent" />
                    {draft.num_pilgrims} traveller{draft.num_pilgrims > 1 ? "s" : ""}
                  </div>
                  {draft.nights_makkah + draft.nights_madinah > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-brand-accent" />
                      {tripDurationDays({
                        numPilgrims: draft.num_pilgrims,
                        nightsMakkah: draft.nights_makkah,
                        nightsMadinah: draft.nights_madinah,
                      })}{" "}
                      days
                    </div>
                  ) : null}
                  {draft.subtotal > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Calculator className="size-4 text-brand-accent" />
                      {formatMoney(draft.subtotal, draft.currency)} so far
                    </div>
                  ) : null}
                </dl>
                <Button
                  render={<Link href={`/umrah/private/${draft.id}?step=${draft.current_step}`} />}
                  size="lg"
                  className="mt-7 gap-2"
                >
                  Resume your trip <ArrowRight className="size-4" />
                </Button>
                <p className="mt-3 text-xs text-sidebar-foreground/60">
                  Reference {draft.reference} · still nothing is booked until you review and submit.
                </p>
              </>
            ) : (
              <>
                <Badge className="border-transparent bg-brand-accent/20 text-sidebar-foreground">
                  <Settings2 className="size-3.5" /> Individual / Private Umrah
                </Badge>
                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  Build your Umrah, exactly the way you want it
                </h1>
                <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
                  For one traveller, a couple, a family or a small party. Choose your hotels in
                  Makkah and Madinah, your flights, your visa, your transport and anything else you
                  need — the price adds up as you go, with no surprises at the end.
                </p>
                <form action={startUmrahCustomRequest} className="mt-7">
                  <SubmitButton size="lg" pendingText="Setting up your trip…" className="gap-2">
                    Start building <ArrowRight className="size-4" />
                  </SubmitButton>
                </form>
                <p className="mt-3 text-xs text-sidebar-foreground/60">
                  You can save and come back — nothing is booked until you review and submit.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-heading text-lg font-bold">How it works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                  {step.n}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-xl border border-border bg-secondary/40 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Calculator className="size-4 text-primary" /> How the price is worked out
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every service has its own rate and its own unit — hotels are per person per night,
              flights and visas are per person, and a private car is one price for your whole party.
              Add them up and that is your Umrah price:
            </p>
            <p className="mt-3 rounded-lg bg-card px-4 py-3 font-mono text-xs leading-relaxed">
              Flight + Visa + Makkah hotel + Madinah hotel + Transport + Train + VIP service ={" "}
              <span className="font-bold text-primary">Total Umrah price</span>
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-border p-5">
            <p className="flex items-center gap-2 font-semibold">
              <UsersRound className="size-4 text-primary" /> Would a group package suit you better?
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              If you would rather not choose each service, our group packages come ready-made at a
              fixed price per person — {UMRAH_TIERS.map((t) => t.label).join(", ")}.
            </p>
            <Button render={<Link href="/umrah/group" />} variant="outline" size="sm" className="mt-3 gap-1.5">
              See group packages <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <aside>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <ListChecks className="size-3.5" /> What you can choose
            </p>
            <ul className="mt-4 space-y-3">
              {UMRAH_CATEGORIES.map((category) => {
                const from = cheapestByCategory.get(category.value);
                return (
                  <li key={category.value} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <category.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{category.label}</p>
                      <p className="text-xs text-muted-foreground">{category.hint}</p>
                      {from ? (
                        <p className="mt-0.5 text-xs font-medium text-primary">
                          from {formatMoney(from.price, from.currency)} {from.unit}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {services.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Our team is finalising this season&apos;s rates. Start a trip anyway and we will get
                in touch with prices.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
