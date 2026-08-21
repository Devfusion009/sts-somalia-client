"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Pencil,
  Send,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import { submitUmrahCustomRequest, type PilgrimInput } from "@/modules/umrah/custom-actions";
import { UMRAH_CATEGORIES, UMRAH_TIER_LABELS, type UmrahServiceCategory, type UmrahTier } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays, tripReturnDate, type TripShape } from "@/modules/umrah/pricing";
import { TripNotFoundRecovery } from "./builder-shared";

type Line = {
  id: string;
  category: UmrahServiceCategory;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EditLink({ requestId, step }: { requestId: string; step: number }) {
  return (
    <Button render={<Link href={`/umrah/private/${requestId}?step=${step}`} />} variant="ghost" size="sm" className="h-7 gap-1 text-xs">
      <Pencil className="size-3" /> Edit
    </Button>
  );
}

export function StepReview({
  requestId,
  reference,
  tier,
  trip,
  departureDate,
  lines,
  total,
  currency,
  pilgrims,
  notes,
  bookedForSlot,
}: {
  requestId: string;
  reference: string;
  tier: UmrahTier;
  trip: TripShape;
  departureDate: string | null;
  lines: Line[];
  total: number;
  currency: string;
  pilgrims: PilgrimInput[];
  notes: string | null;
  bookedForSlot?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(submitUmrahCustomRequest, null);
  const duration = tripDurationDays(trip);
  const returnDate = tripReturnDate(departureDate, trip);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />

      <div>
        <h2 className="font-heading text-xl font-bold">Review your Umrah</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check everything below, then send it to our team. Reference{" "}
          <span className="font-mono font-medium text-foreground">{reference}</span>.
        </p>
      </div>

      {/* Trip */}
      <section className="rounded-xl border border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CalendarDays className="size-4 text-primary" /> Your trip
          </h3>
          <EditLink requestId={requestId} step={1} />
        </header>
        <dl className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Travellers</dt>
            <dd className="font-semibold">{trip.numPilgrims}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Departure</dt>
            <dd className="font-semibold">{formatDate(departureDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Return</dt>
            <dd className="font-semibold">{formatDate(returnDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Length</dt>
            <dd className="font-semibold">
              {duration} days / {Math.max(0, duration - 1)} nights
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nights in Makkah</dt>
            <dd className="font-semibold">{trip.nightsMakkah}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nights in Madinah</dt>
            <dd className="font-semibold">{trip.nightsMadinah}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Standard</dt>
            <dd className="font-semibold">{UMRAH_TIER_LABELS[tier]}</dd>
          </div>
        </dl>
      </section>

      {/* Services & price */}
      <section className="rounded-xl border border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Check className="size-4 text-primary" /> Your services
          </h3>
          <EditLink requestId={requestId} step={2} />
        </header>
        {lines.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No services selected yet — go back to step 2.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {UMRAH_CATEGORIES.map((category) => {
              const group = lines.filter((l) => l.category === category.value);
              if (group.length === 0) return null;
              return (
                <div key={category.value} className="px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <category.icon className="size-3.5 text-primary" />
                    {category.label}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {group.map((line) => (
                      <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2 pl-5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {formatMoney(line.unit_price, currency)}
                            </span>{" "}
                            × {line.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums">
                          {formatMoney(line.line_total, currency)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border bg-secondary/40 px-4 py-4">
          <div>
            <p className="text-sm font-bold">Total Umrah price</p>
            {trip.numPilgrims > 1 ? (
              <p className="text-xs text-muted-foreground">
                {formatMoney(total / trip.numPilgrims, currency)} per traveller
              </p>
            ) : null}
          </div>
          <p className="font-heading text-2xl font-bold text-primary tabular-nums">
            {formatMoney(total, currency)}
          </p>
        </div>
      </section>

      {/* Travellers */}
      <section className="rounded-xl border border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4 text-primary" /> Travellers
          </h3>
          <EditLink requestId={requestId} step={3} />
        </header>
        <ul className="divide-y divide-border">
          {pilgrims.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="font-semibold">{p.full_name}</span>
              <Badge variant="secondary" className="text-[10px] capitalize">
                {p.gender}
              </Badge>
              {p.passport_number ? (
                <span className="text-xs text-muted-foreground">
                  Passport {p.passport_number}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Passport details to follow</span>
              )}
            </li>
          ))}
        </ul>
        {notes ? (
          <>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">Your notes</p>
              <p className="mt-0.5 text-sm">{notes}</p>
            </div>
          </>
        ) : null}
      </section>

      {bookedForSlot}

      <Alert>
        <Send />
        <AlertDescription>
          Submitting sends this to the STS Umrah team. We confirm your hotels, seats and visa slots
          for these exact dates — usually within one working day — and only then do you pay. The
          price above is what you will be charged unless we tell you otherwise first.
        </AlertDescription>
      </Alert>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="space-y-2">
            <p>{state.error}</p>
            <TripNotFoundRecovery error={state.error} />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button render={<Link href={`/umrah/private/${requestId}?step=3`} />} variant="ghost" className="gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <SubmitButton size="lg" pendingText="Submitting…" className="gap-2" disabled={total <= 0}>
          Submit my Umrah request <Send className="size-4" />
        </SubmitButton>
      </div>
    </form>
  );
}
