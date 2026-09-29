"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  MapPin,
  Receipt,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahTripServices } from "@/modules/umrah/custom-actions";
import {
  PRICE_UNIT_LABELS,
  ROOM_SHARING_LABELS,
  ROOM_SHARING_OPTIONS,
  UMRAH_CATEGORIES,
  UMRAH_TIER_LABELS,
  UMRAH_TIER_CHIP_CLASS,
  type RoomSharing,
  type UmrahCategoryConfig,
  type UmrahService,
  type UmrahServiceCategory,
  type UmrahTier,
} from "@/modules/umrah/services";
import {
  formatMoney,
  isSharingPricedCategory,
  priceService,
  priceSelection,
  type SharingContext,
  type SharingPriceMap,
  type TripShape,
} from "@/modules/umrah/pricing";
import { TripNotFoundRecovery } from "./builder-shared";
import { cn } from "@/lib/utils";

/**
 * Preselects the tier's defaults for a customer arriving on this step for the
 * first time. Once they have made ANY choice their selection wins outright —
 * re-applying defaults on every render would fight the person using the form.
 */
function initialSelection(services: UmrahService[], tier: UmrahTier, saved: string[]): Set<string> {
  if (saved.length) return new Set(saved);
  return new Set(
    services.filter((s) => s.is_default && (s.tier === tier || s.tier === null)).map((s) => s.id)
  );
}

/** Nights this category's "no nights, no need" gate checks against. */
function categoryNights(category: UmrahCategoryConfig, trip: TripShape): number {
  if (category.nights === "makkah") return trip.nightsMakkah;
  if (category.nights === "madinah") return trip.nightsMadinah;
  return trip.nightsMakkah + trip.nightsMadinah;
}

export function StepServices({
  requestId,
  services,
  trip,
  tier,
  currency,
  savedServiceIds,
  initialRoomSharing,
  sharingPrices,
  desk,
}: {
  requestId: string;
  services: UmrahService[];
  trip: TripShape;
  tier: UmrahTier;
  currency: string;
  savedServiceIds: string[];
  initialRoomSharing: RoomSharing;
  sharingPrices: SharingPriceMap;
  /** True when this builder is hosted inside the agent portal — see
   *  wizardBasePath() in custom-actions.ts. */
  desk?: boolean;
}) {
  const basePath = desk ? "/agent/book/umrah/private" : "/umrah/private";
  const [state, formAction] = useActionState(saveUmrahTripServices, null);
  const [roomSharing, setRoomSharing] = useState<RoomSharing>(initialRoomSharing);
  const sharing = useMemo<SharingContext>(
    () => ({ roomSharing, sharingPrices }),
    [roomSharing, sharingPrices]
  );
  const [selected, setSelected] = useState<Set<string>>(() =>
    initialSelection(services, tier, savedServiceIds)
  );

  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const { lines, total } = useMemo(() => {
    const chosen = [...selected].map((id) => byId.get(id)).filter((s): s is UmrahService => !!s);
    return priceSelection(chosen, trip, sharing);
  }, [selected, byId, trip, sharing]);

  function toggle(service: UmrahService, selection: "single" | "multi") {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(service.id)) {
        next.delete(service.id);
        return next;
      }
      if (selection === "single") {
        // A single-choice category holds exactly one option, so taking a new
        // one releases whatever was held before. Without this the DB's
        // one-row-per-category index would reject the save with a constraint
        // error the customer can do nothing about.
        for (const id of prev) {
          if (byId.get(id)?.category === service.category) next.delete(id);
        }
      }
      next.add(service.id);
      return next;
    });
  }

  // Categories with nothing that can "run out" (extra services are opt-in by
  // nature, and a hotel with zero nights in that city is intentionally
  // skipped) don't belong in a completion count — 0 chosen there is a valid,
  // finished state, not unfinished business. Only required, applicable
  // single-choice categories count.
  const requiredCategories = UMRAH_CATEGORIES.filter(
    (c) => c.selection === "single" && !(c.requiredWhen && categoryNights(c, trip) === 0)
  );
  const completedCount = requiredCategories.filter((c) =>
    services.some((s) => s.category === c.value && selected.has(s.id))
  ).length;

  return (
    <>
      {/* No docked sidebar: on the widths this wizard actually runs at (it
          sits beside a 260px stepper rail already), a permanent 336px price
          column left the option grid too narrow to show a hotel's rating and
          distance without wrapping badly. The running total lives in a
          floating trigger instead (rendered at the bottom of this file) —
          out of the way while choosing, one tap from full detail whenever
          it's wanted. */}
      <form action={formAction} className="space-y-9" id="services-form">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="room_sharing" value={roomSharing} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="service_id" value={id} />
        ))}

        <div>
          <h2 className="font-heading text-xl font-bold">Choose your services</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your <span className="font-semibold text-foreground">{UMRAH_TIER_LABELS[tier]}</span>{" "}
            picks are already selected below — change anything you like.
          </p>
        </div>

        {/* Quick-jump rail: seven categories is a long page to scroll blind
            through, and each pill doubles as a completion tracker — a solid
            check the moment that category is settled, so there's always a
            glance-able answer to "what's left". */}
        <nav
          aria-label="Jump to a service category"
          className="sticky top-24 z-10 -mx-1 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-1 pb-4 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UMRAH_CATEGORIES.map((category) => {
            const applicable = !(category.requiredWhen && categoryNights(category, trip) === 0);
            const count = applicable
              ? services.filter((s) => s.category === category.value && selected.has(s.id)).length
              : 0;
            return (
              <a
                key={category.value}
                href={`#${category.value}`}
                aria-disabled={!applicable}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  !applicable
                    ? "border-border text-muted-foreground/50"
                    : count > 0
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {count > 0 ? <Check className="size-3.5" /> : <category.icon className="size-3.5" />}
                {category.label}
              </a>
            );
          })}
        </nav>

        <section aria-labelledby="room-type-heading">
          <h3 id="room-type-heading" className="flex items-center gap-2.5 font-heading text-base font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
              <BedDouble className="size-4.5" />
            </span>
            Room type
          </h3>
          <div
            role="radiogroup"
            aria-labelledby="room-type-heading"
            className="mt-3 ml-11.5 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {ROOM_SHARING_OPTIONS.map((option) => {
              const active = roomSharing === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRoomSharing(option.value)}
                  className={cn(
                    "flex flex-col rounded-2xl border-2 px-4 py-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/[0.04] shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className={cn("text-sm font-semibold", active && "text-primary")}>
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {option.value} {option.value === 1 ? "guest" : "guests"} per room
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {UMRAH_CATEGORIES.map((category) => {
          const all = services.filter((s) => s.category === category.value);
          if (all.length === 0) return null;

          // Every option, every time — sorted with this trip's own standard
          // first so the recommended picks stay easy to spot, but nothing is
          // hidden behind a click. A customer comparing a Basic hotel against
          // a Premium one is a completely normal thing to want to do.
          const visible = [...all].sort((a, b) => {
            const aMatch = a.tier === tier || a.tier === null ? 0 : 1;
            const bMatch = b.tier === tier || b.tier === null ? 0 : 1;
            return aMatch - bMatch;
          });

          const notApplicable = category.requiredWhen && categoryNights(category, trip) === 0;
          const chosenCount = all.filter((s) => selected.has(s.id)).length;

          return (
            <section key={category.value} className="scroll-mt-40" id={category.value}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2.5 font-heading text-base font-bold">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
                    <category.icon className="size-4.5" />
                  </span>
                  {category.label}
                  {category.selection === "single" && !notApplicable ? (
                    <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary">
                      <span className="size-1.5 rounded-full bg-primary" /> Choose one
                    </Badge>
                  ) : null}
                  {category.selection === "multi" ? (
                    <Badge variant="outline" className="gap-1 border-brand-accent/30 text-[10px] text-brand-accent">
                      <span className="size-1.5 rounded-xs bg-brand-accent" /> Optional
                    </Badge>
                  ) : null}
                </h3>
                {chosenCount > 0 ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <Check className="size-3.5" /> {chosenCount} selected
                  </span>
                ) : null}
              </div>
              {/* Skipped for the two hotel categories: their hint is "priced
                  per person, per night" — the same words every card in the
                  grid already states next to its own price. One sentence
                  saying it once, on the section that needs it, reads as
                  guidance; the same sentence repeated on every category
                  reads as noise. */}
              {category.value !== "hotel_makkah" && category.value !== "hotel_madinah" ? (
                <p className="mt-1 ml-11.5 text-sm text-muted-foreground">{category.hint}</p>
              ) : null}

              {notApplicable ? (
                <p className="mt-3 ml-11.5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  You have no nights booked in this city, so no hotel is needed. Go back to step 1
                  to add nights.
                </p>
              ) : (
                <div className="mt-3 ml-11.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((service) => (
                    <ServiceOptionCard
                      key={service.id}
                      service={service}
                      trip={trip}
                      sharing={sharing}
                      tier={tier}
                      active={selected.has(service.id)}
                      selection={category.selection}
                      onToggle={() => toggle(service, category.selection)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {state?.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="space-y-2">
              <p>{state.error}</p>
              <TripNotFoundRecovery error={state.error} basePath={basePath} />
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 pb-20">
          <Button render={<Link href={`${basePath}/${requestId}?step=1`} />} variant="ghost" className="gap-2">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <SubmitButton size="lg" pendingText="Saving your selection…" className="gap-2">
            Continue to traveller details <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      </form>

      <FloatingSummary
        lines={lines}
        total={total}
        currency={currency}
        trip={trip}
        roomSharing={roomSharing}
        completedCount={completedCount}
        requiredCount={requiredCategories.length}
      />
    </>
  );
}

/**
 * One selectable option. The indicator IS the affordance: a circle that
 * fills for a "choose one" category, a square that checks for "choose any" —
 * the same shapes a native radio/checkbox would draw, so which behaviour a
 * category has is legible without reading its badge.
 */
function ServiceOptionCard({
  service,
  trip,
  sharing,
  tier,
  active,
  selection,
  onToggle,
}: {
  service: UmrahService;
  trip: TripShape;
  sharing: SharingContext;
  tier: UmrahTier;
  active: boolean;
  selection: "single" | "multi";
  onToggle: () => void;
}) {
  const priced = priceService(service, trip, sharing);
  const byOccupancy = isSharingPricedCategory(service.category);
  const recommended = service.is_default && service.tier === tier;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col rounded-2xl border-2 p-4 pt-5 text-left transition-all",
        active
          ? "border-primary bg-primary/[0.04] shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
      )}
    >
      {recommended ? (
        <span className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-brand-accent px-2 py-0.5 text-xs font-bold text-brand-accent-foreground">
          <Sparkles className="size-2.5" /> Recommended
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug font-semibold">{service.name}</span>
          {service.description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {service.description}
            </span>
          ) : null}
        </span>

        {/* Radio for single-select, checkbox for multi — see the function
            comment above for why the shape itself is load-bearing here. */}
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 transition-colors",
            selection === "single" ? "rounded-full" : "rounded-[5px]",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/35 bg-card group-hover:border-primary/50"
          )}
          aria-hidden
        >
          {active ? (
            selection === "single" ? (
              <span className="size-2 rounded-full bg-primary-foreground" />
            ) : (
              <Check className="size-3" strokeWidth={3} />
            )
          ) : null}
        </span>
      </div>

      {service.star_rating || service.distance_to_haram_m !== null || (service.tier && service.tier !== tier) ? (
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {service.star_rating ? (
            <span className="flex items-center gap-0.5" aria-label={`${service.star_rating} star`}>
              {Array.from({ length: service.star_rating }).map((_, i) => (
                <Star key={i} className="size-3 fill-brand-gold text-brand-gold" />
              ))}
            </span>
          ) : null}
          {service.distance_to_haram_m !== null ? (
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              <MapPin className="size-3" />
              {service.distance_to_haram_m < 1000
                ? `${service.distance_to_haram_m}m from the Haram`
                : `${(service.distance_to_haram_m / 1000).toFixed(1)}km from the Haram`}
            </span>
          ) : null}
          {/* A colour a reader recognises at a glance beats "PREMIUM OPTION"
              in small caps, which they have to actually read. One pill,
              folded into the row it already scans for stars and distance,
              instead of a whole extra line at the bottom of the card. */}
          {service.tier && service.tier !== tier ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", UMRAH_TIER_CHIP_CLASS[service.tier])}>
              {UMRAH_TIER_LABELS[service.tier]}
            </span>
          ) : null}
        </span>
      ) : null}

      <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{formatMoney(priced.unitPrice, service.currency)}</span>{" "}
          {PRICE_UNIT_LABELS[service.price_unit]}
          {byOccupancy ? ` · ${ROOM_SHARING_LABELS[sharing.roomSharing]}` : null}
        </span>
        <span className="font-heading text-base font-bold text-primary tabular-nums">
          {formatMoney(priced.lineTotal, service.currency)}
        </span>
      </span>
    </button>
  );
}

type LiveLine = {
  category: UmrahServiceCategory;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/**
 * The running total, tucked away by default. A docked sidebar always claims
 * its width whether anyone is looking at it or not; this is a slim pill —
 * total + item count — fixed above the site's WhatsApp button, that opens
 * into the full breakdown on tap and gets back out of the way on close. The
 * full option grid gets the screen the rest of the time.
 */
function FloatingSummary({
  lines,
  total,
  currency,
  trip,
  roomSharing,
  completedCount,
  requiredCount,
}: {
  lines: LiveLine[];
  total: number;
  currency: string;
  trip: TripShape;
  roomSharing: RoomSharing;
  completedCount: number;
  requiredCount: number;
}) {
  const nights = trip.nightsMakkah + trip.nightsMadinah;
  const progress = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : 100;
  const done = completedCount >= requiredCount;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            // bottom-24 clears the site-wide WhatsApp button (fixed bottom-5,
            // size-13) with room to spare, rather than stacking on top of it.
            className="fixed right-5 bottom-24 z-40 flex items-center gap-3 rounded-full border border-border bg-card py-2 pr-4 pl-3 shadow-lg transition-transform hover:scale-[1.03]"
          />
        }
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Receipt className="size-4.5" />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-[11px] text-muted-foreground">
            {lines.length > 0 ? `${completedCount}/${requiredCount} chosen` : "View summary"}
          </span>
          <span className="block font-heading text-sm font-bold text-primary tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </span>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Umrah price</SheetTitle>
          <SheetDescription>
            {trip.numPilgrims} traveller{trip.numPilgrims > 1 ? "s" : ""} · {nights} night
            {nights === 1 ? "" : "s"} ({trip.nightsMakkah} Makkah / {trip.nightsMadinah} Madinah) ·{" "}
            {ROOM_SHARING_LABELS[roomSharing]} room
          </SheetDescription>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Services chosen</span>
            <span className={cn("text-[11px] font-semibold", done ? "text-primary" : "text-muted-foreground")}>
              {completedCount}/{requiredCount}
            </span>
          </div>
          <Progress value={progress}>
            <span className="sr-only">{progress}% of required services chosen</span>
          </Progress>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {lines.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Nothing selected yet. Tick the services you need and your total will build up here.
            </p>
          ) : (
            // Grouped in the SAME order the categories appear in the picker
            // above — not the order they were clicked in, which is what
            // `lines` (built off a Set of selected ids) would otherwise show
            // and reads as random in a receipt.
            <div className="space-y-4">
              {UMRAH_CATEGORIES.map((category) => {
                const group = lines.filter((l) => l.category === category.value);
                if (group.length === 0) return null;
                return (
                  <div key={category.value}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <category.icon className="size-3.5 text-primary" />
                      {category.label}
                    </p>
                    <ul className="mt-1.5 space-y-2 border-l border-border pl-2.5">
                      {group.map((line, i) => (
                        <li key={`${line.category}-${line.name}-${i}`} className="text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 flex-1 font-medium">{line.name}</span>
                            <span className="shrink-0 font-semibold tabular-nums">
                              {formatMoney(line.lineTotal, currency)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {formatMoney(line.unitPrice, currency)}
                            </span>{" "}
                            × {line.quantity}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border">
          <Separator className="mb-1" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="font-heading text-2xl font-bold text-primary tabular-nums">
              {formatMoney(total, currency)}
            </span>
          </div>
          {trip.numPilgrims > 1 && total > 0 ? (
            <p className="text-right text-xs text-muted-foreground">
              {formatMoney(total / trip.numPilgrims, currency)} per traveller
            </p>
          ) : null}
          <Button type="submit" form="services-form" className="mt-2 w-full gap-2" size="lg">
            Continue to traveller details <ArrowRight className="size-4" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
