"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowRight, Minus, Plus, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahTripBasics } from "@/modules/umrah/custom-actions";
import { UMRAH_TIERS, UMRAH_TIER_LABELS, type UmrahTier } from "@/modules/umrah/services";
import { tripDurationDays, tripReturnDate } from "@/modules/umrah/pricing";
import { Field, TripNotFoundRecovery } from "./builder-shared";
import { cn } from "@/lib/utils";

// A fixed format (not toLocaleDateString) so server and client render the same text.
function formatDisplayDate(iso: string) {
  return format(parseISO(iso), "d MMM yyyy");
}

/** A +/- stepper. Nights and travellers are small integers people nudge. */
function Counter({
  name,
  value,
  onChange,
  min = 0,
  max = 60,
  id,
  ariaName
}: {
  name: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  id?: string;
  /** Names the +/- buttons for screen readers, e.g. "nights in Makkah". */
  ariaName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={ariaName ? `Fewer ${ariaName}` : "Decrease"}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" aria-hidden />
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
        className="w-20 text-center tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={ariaName ? `More ${ariaName}` : "Increase"}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" aria-hidden />
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
          <div className="mt-4">
            <Field label="Number of travellers" htmlFor="num_pilgrims" required>
              <Counter
                id="num_pilgrims"
                name="num_pilgrims"
                value={numPilgrims}
                onChange={updateNumPilgrims}
                min={1}
                max={40}
                ariaName="travellers"
              />
            </Field>
          </div>

          <div className="mt-5 space-y-3">
            {travellerNames.map((name, i) => (
              <Field
                key={i}
                label={
                  i === 0 ? (
                    <span className="flex flex-wrap items-center gap-2">
                      Lead traveller&apos;s full name (as in passport)
                      {/* On the agent desk the agent is not the traveller. */}
                      {!desk ? <Badge variant="info">That&apos;s you</Badge> : null}
                    </span>
                  ) : (
                    `Traveller ${i + 1}'s full name (as in passport)`
                  )
                }
                htmlFor={`traveller_name_${i}`}
                required
              >
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold">
            2. When would you like to travel?
          </h2>
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
                ariaName="nights in Makkah"
              />
            </Field>
            <Field label="Nights in Madinah" htmlFor="nights_madinah" required>
              <Counter
                id="nights_madinah"
                name="nights_madinah"
                value={nightsMadinah}
                onChange={setNightsMadinah}
                ariaName="nights in Madinah"
              />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold">
            3. What standard would you like?
          </h2>
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
                    "rounded-xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-primary shadow-sm ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className="block font-heading text-sm font-bold">{option.label}</span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
          <SubmitButton size="lg" pendingText="Saving…" className="w-full gap-2 sm:w-auto">
            Continue to services <ArrowRight className="size-4" aria-hidden />
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-bold">Your trip</h2>
        <Badge variant="neutral" className="font-semibold">
          {UMRAH_TIER_LABELS[tier]}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        <TripStatTile value={numPilgrims} label={numPilgrims === 1 ? "Traveller" : "Travellers"} />
        <TripStatTile value={duration || "–"} label="Days" />
        <TripStatTile value={nightsMakkah} label="Nights Makkah" />
        <TripStatTile value={nightsMadinah} label="Nights Madinah" />
      </dl>

      {departureDate || returnDate ? (
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {departureDate ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Departure</dt>
              <dd className="font-medium tabular-nums">{formatDisplayDate(departureDate)}</dd>
            </div>
          ) : null}
          {returnDate ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Returning</dt>
              <dd className="font-medium tabular-nums">{formatDisplayDate(returnDate)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function TripStatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-secondary/40 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
