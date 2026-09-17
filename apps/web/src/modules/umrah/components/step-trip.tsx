"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Minus,
  Moon,
  Plus,
  User,
  Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahTripBasics } from "@/modules/umrah/custom-actions";
import {
  UMRAH_TIERS,
  UMRAH_TIER_LABELS,
  UMRAH_TIER_CHIP_CLASS,
  type UmrahTier
} from "@/modules/umrah/services";
import { tripDurationDays, tripReturnDate } from "@/modules/umrah/pricing";
import { Field, TripNotFoundRecovery } from "./builder-shared";
import { cn } from "@/lib/utils";

function formatDisplayDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** A +/- stepper. Nights and travellers are small integers people nudge. */
function Counter({
  name,
  value,
  onChange,
  min = 0,
  max = 60,
  id
}: {
  name: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(
            Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min
          );
        }}
        className="w-20 text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

export function StepTrip({
  requestId,
  initial,
  desk
}: {
  requestId: string;
  initial: {
    tier: UmrahTier;
    numPilgrims: number;
    departureDate: string | null;
    nightsMakkah: number;
    nightsMadinah: number;
    /** Names already saved (from a previous visit to this step, or from
     *  step 3). Padded/truncated to numPilgrims by the caller. */
    travellerNames: string[];
  };
  /** True when this builder is hosted inside the agent portal — see
   *  wizardBasePath() in custom-actions.ts. */
  desk?: boolean;
}) {
  const basePath = desk ? "/agent/book/umrah/private" : "/umrah/private";
  const [state, formAction] = useActionState(saveUmrahTripBasics, null);
  const [tier, setTier] = useState<UmrahTier>(initial.tier);
  const [numPilgrims, setNumPilgrims] = useState(initial.numPilgrims);
  const [nightsMakkah, setNightsMakkah] = useState(initial.nightsMakkah);
  const [nightsMadinah, setNightsMadinah] = useState(initial.nightsMadinah);
  const [departureDate, setDepartureDate] = useState(
    initial.departureDate ?? ""
  );
  const [travellerNames, setTravellerNames] = useState<string[]>(
    initial.travellerNames
  );

  // The name list has to track the traveller count exactly — one input per
  // person, no more, no fewer, or the server would receive a mismatched
  // traveller_name_{i} set. Growing keeps whatever was already typed;
  // shrinking drops from the end rather than the front, so trimming back
  // down after overshooting doesn't discard the lead traveller's name.
  function updateNumPilgrims(next: number) {
    setNumPilgrims(next);
    setTravellerNames((prev) => {
      if (next === prev.length) return prev;
      if (next < prev.length) return prev.slice(0, next);
      return [...prev, ...Array.from({ length: next - prev.length }, () => "")];
    });
  }

  function updateTravellerName(index: number, value: string) {
    setTravellerNames((prev) =>
      prev.map((name, i) => (i === index ? value : name))
    );
  }

  const trip = { numPilgrims, nightsMakkah, nightsMadinah };
  const duration = tripDurationDays(trip);
  const returnDate = tripReturnDate(departureDate || null, trip);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
      <form action={formAction} className="space-y-8">
        <input type="hidden" name="requestId" value={requestId} />
        {desk ? <input type="hidden" name="desk" value="1" /> : null}

        <section>
          <h2 className="font-heading text-lg font-bold">
            1. Who is travelling?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Include everyone who needs a visa, a seat and a bed — yourself
            included.
          </p>
          <div className="mt-4">
            <Field label="Number of travellers" htmlFor="num_pilgrims" required>
              <Counter
                id="num_pilgrims"
                name="num_pilgrims"
                value={numPilgrims}
                onChange={updateNumPilgrims}
                min={1}
                max={40}
              />
            </Field>
          </div>

          <div className="mt-5 space-y-3">
            {travellerNames.map((name, i) => (
              <Field
                key={i}
                label={
                  i === 0 ? (
                    <span className="flex items-center gap-2">
                      Lead traveller&apos;s full name (as in passport)
                      <Badge className="border-transparent bg-chart-3/10 text-[10px] text-chart-3">
                        That&apos;s you
                      </Badge>
                    </span>
                  ) : (
                    `Traveller ${i + 1}'s full name (as in passport)`
                  )
                }
                htmlFor={`traveller_name_${i}`}
                required
              >
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id={`traveller_name_${i}`}
                    name={`traveller_name_${i}`}
                    value={name}
                    onChange={(e) => updateTravellerName(i, e.target.value)}
                    placeholder="Enter full name"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>
            ))}
            <p className="text-xs text-muted-foreground">
              Passport number, gender and other details are collected on step 3
              — just names for now.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold">
            2. When would you like to travel?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Choose your departure date and how long you would like to stay in
            each city. Hotel prices are worked out from these nights.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <Field label="Departure date" htmlFor="departure_date" required>
              <Input
                id="departure_date"
                name="departure_date"
                type="date"
                min={today}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Nights in Makkah" htmlFor="nights_makkah" required>
              <Counter
                id="nights_makkah"
                name="nights_makkah"
                value={nightsMakkah}
                onChange={setNightsMakkah}
              />
            </Field>
            <Field label="Nights in Madinah" htmlFor="nights_madinah" required>
              <Counter
                id="nights_madinah"
                name="nights_madinah"
                value={nightsMadinah}
                onChange={setNightsMadinah}
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold">
            3. What standard would you like?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            This sets your starting selection on the next step. You can change
            any individual choice afterwards.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {UMRAH_TIERS.map((option) => {
              const active = tier === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTier(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border bg-card p-4 text-left transition-all",
                    active
                      ? "border-primary shadow-sm ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                      option.className
                    )}
                  >
                    {option.label}
                  </span>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {option.blurb}
                  </p>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="tier" value={tier} />
        </section>

        {state?.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="space-y-2">
              <p>{state.error}</p>
              <TripNotFoundRecovery error={state.error} basePath={basePath} />
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
            Continue to services <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      </form>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <TripSummary
          numPilgrims={numPilgrims}
          tier={tier}
          duration={duration}
          nightsMakkah={nightsMakkah}
          nightsMadinah={nightsMadinah}
          departureDate={departureDate || null}
          returnDate={returnDate}
        />
      </aside>
    </div>
  );
}

/**
 * A live recap of the fields on this step, not a second place to edit them —
 * every number here comes straight from the same state the form itself
 * reads, so there is nowhere for this card and the form to disagree.
 */
function TripSummary({
  numPilgrims,
  tier,
  duration,
  nightsMakkah,
  nightsMadinah,
  departureDate,
  returnDate
}: {
  numPilgrims: number;
  tier: UmrahTier;
  duration: number;
  nightsMakkah: number;
  nightsMadinah: number;
  departureDate: string | null;
  returnDate: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        Your trip so far
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          {numPilgrims} traveller{numPilgrims === 1 ? "" : "s"}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            UMRAH_TIER_CHIP_CLASS[tier]
          )}
        >
          {UMRAH_TIER_LABELS[tier]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <TripStatTile
          icon={CalendarDays}
          value={duration || "–"}
          label="Days"
          tone="bg-primary/10 text-primary"
        />
        <TripStatTile
          icon={Moon}
          value={nightsMakkah}
          label="Nights Makkah"
          tone="bg-brand-gold/15 text-brand-gold"
        />
        <TripStatTile
          icon={Moon}
          value={nightsMadinah}
          label="Nights Madinah"
          tone="bg-chart-2/10 text-chart-2"
        />
      </div>

      {departureDate || returnDate ? (
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {departureDate ? (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="size-3.5" /> Departure
              </dt>
              <dd className="font-medium">
                {formatDisplayDate(departureDate)}
              </dd>
            </div>
          ) : null}
          {returnDate ? (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="size-3.5" /> Returning
              </dt>
              <dd className="font-medium">{formatDisplayDate(returnDate)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function TripStatTile({
  icon: Icon,
  value,
  label,
  tone
}: {
  icon: typeof CalendarDays;
  value: number | string;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-secondary/30 py-3 text-center">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          tone
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="font-heading text-lg font-bold tabular-nums">
        {value}
      </span>
      <span className="px-1 text-[9px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
