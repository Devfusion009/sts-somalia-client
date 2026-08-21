import Link from "next/link";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { REQUEST_NOT_EDITABLE_ERROR } from "@/modules/umrah/custom-errors";
import { cn } from "@/lib/utils";
import { UMRAH_CATEGORIES, type UmrahServiceCategory } from "@/modules/umrah/services";
import { formatMoney, type TripShape } from "@/modules/umrah/pricing";

export const BUILDER_STEPS = [
  { step: 1, label: "Your trip", hint: "Travellers, dates & standard" },
  { step: 2, label: "Choose your services", hint: "Hotels, flights, transport" },
  { step: 3, label: "Traveller details", hint: "Passport details" },
  { step: 4, label: "Review & submit", hint: "Check the total" },
] as const;

/**
 * The wizard's left rail. Steps up to `maxStep` are navigable so a customer
 * can go back and change the party size without losing what they picked;
 * later steps are locked because their forms depend on answers that do not
 * exist yet.
 */
export function BuilderStepper({
  requestId,
  currentStep,
  maxStep,
}: {
  requestId: string;
  currentStep: number;
  maxStep: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        Private Umrah
      </p>
      <ol className="mt-4 space-y-1">
        {BUILDER_STEPS.map(({ step, label, hint }) => {
          const isCurrent = step === currentStep;
          const isDone = step < currentStep;
          const isLocked = step > maxStep;
          const marker = isDone ? <Check className="size-3.5" /> : isLocked ? <Lock className="size-3" /> : step;

          const content = (
            <span className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {marker}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    isCurrent ? "text-primary" : isLocked ? "text-muted-foreground" : ""
                  )}
                >
                  {label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {isCurrent ? "In progress" : isDone ? "Completed" : hint}
                </span>
              </span>
            </span>
          );

          return (
            <li key={step} className="relative">
              {step < BUILDER_STEPS.length ? (
                <span
                  aria-hidden
                  className="absolute top-8 left-3 h-[calc(100%-1.25rem)] w-px bg-border"
                />
              ) : null}
              {isLocked ? (
                <span className="block rounded-lg px-2 py-2">{content}</span>
              ) : (
                <Link
                  href={`/umrah/private/${requestId}?step=${step}`}
                  className={cn(
                    "block rounded-lg px-2 py-2 transition-colors hover:bg-accent/60",
                    isCurrent && "bg-secondary"
                  )}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Nothing is booked and no payment is taken until you review and submit.
      </p>
    </div>
  );
}

export type SummaryLine = {
  category: UmrahServiceCategory;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/**
 * The running total. Present on every step of the wizard, because "the system
 * automatically calculates and shows the total price" is the whole point of
 * the private flow — a total that only appears at the end is a quote, not a
 * builder.
 */
export function PriceSummary({
  lines,
  total,
  currency,
  trip,
  emptyText = "Pick your services and the total will appear here.",
  className,
}: {
  lines: SummaryLine[];
  total: number;
  currency: string;
  trip: TripShape;
  emptyText?: string;
  className?: string;
}) {
  const nights = trip.nightsMakkah + trip.nightsMadinah;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-xs", className)}>
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        Your Umrah price
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {trip.numPilgrims} traveller{trip.numPilgrims > 1 ? "s" : ""} · {nights} night
        {nights === 1 ? "" : "s"} ({trip.nightsMakkah} Makkah / {trip.nightsMadinah} Madinah)
      </p>

      {lines.length === 0 ? (
        <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        // Grouped by category, in the SAME order step 2 presents them
        // (Makkah hotel, Madinah hotel, flights, visa, transport, the
        // intercity leg, extras) — not insertion order, which is whatever
        // sequence the customer happened to click things in on step 2 and
        // reads as random here. A section header per group also means the
        // category only has to be stated once, not restated on every line
        // underneath it.
        <div className="mt-4 space-y-4">
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
                      <div className="flex items-baseline justify-between gap-3">
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

      <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm font-semibold">Total</span>
        <span className="font-heading text-2xl font-bold text-primary tabular-nums">
          {formatMoney(total, currency)}
        </span>
      </div>
      {trip.numPilgrims > 1 && total > 0 ? (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {formatMoney(total / trip.numPilgrims, currency)} per traveller
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Below the destructive Alert whenever a step's action returns
 * REQUEST_NOT_EDITABLE_ERROR — the one save error a customer cannot fix by
 * retrying the same form, since the request itself is gone. Every step
 * renders this the same way, so it lives once, here.
 */
export function TripNotFoundRecovery({ error }: { error: string | null | undefined }) {
  if (error !== REQUEST_NOT_EDITABLE_ERROR) return null;
  return (
    <Button render={<Link href="/umrah/private" />} variant="outline" size="sm" className="gap-1.5">
      Start a new private trip <ArrowRight className="size-3.5" />
    </Button>
  );
}
