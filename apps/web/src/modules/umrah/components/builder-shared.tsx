import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { REQUEST_NOT_EDITABLE_ERROR } from "@/modules/umrah/custom-errors";
import { cn } from "@/lib/utils";
import {
  ROOM_SHARING_LABELS,
  UMRAH_CATEGORIES,
  type RoomSharing,
  type UmrahServiceCategory,
} from "@/modules/umrah/services";
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
  basePath = "/umrah/private",
}: {
  requestId: string;
  currentStep: number;
  maxStep: number;
  /** Set to "/agent/book/umrah/private" when this builder is hosted inside
   *  the agent portal, so its step links stay inside that portal instead of
   *  bouncing back out to the B2C marketing route. */
  basePath?: string;
}) {
  return (
    <nav
      aria-label="Private Umrah steps"
      className="rounded-2xl border border-border bg-card p-2 shadow-xs lg:p-5"
    >
      <p className="hidden text-sm font-semibold text-foreground lg:block">Private Umrah</p>
      {/* Phones/tablets: one compact row of four; lg: the vertical rail. */}
      <ol className="grid grid-cols-4 gap-1 lg:mt-4 lg:block lg:space-y-1">
        {BUILDER_STEPS.map(({ step, label, hint }) => {
          const isCurrent = step === currentStep;
          const isDone = step < currentStep;
          const isLocked = step > maxStep;
          const marker = isDone ? (
            <Check className="size-3.5" aria-hidden />
          ) : isLocked ? (
            <Lock className="size-3" aria-hidden />
          ) : (
            step
          );
          const stateText = isCurrent ? "current step" : isDone ? "completed" : isLocked ? "locked" : null;

          const content = (
            <span className="flex flex-col items-center gap-1.5 text-center lg:flex-row lg:items-start lg:gap-3 lg:text-left">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums lg:mt-0.5",
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
                    "block text-xs leading-tight font-semibold lg:text-sm",
                    isCurrent ? "text-primary" : isLocked ? "text-muted-foreground" : ""
                  )}
                >
                  {label}
                </span>
                <span className="hidden text-xs text-muted-foreground lg:block">{hint}</span>
                {stateText ? <span className="sr-only">, {stateText}</span> : null}
              </span>
            </span>
          );

          return (
            <li key={step} className="relative min-w-0">
              {step < BUILDER_STEPS.length ? (
                <span
                  aria-hidden
                  className="absolute top-8 left-5 hidden h-[calc(100%-1.25rem)] w-px bg-border lg:block"
                />
              ) : null}
              {isLocked ? (
                <span className="block rounded-lg px-1 py-2 lg:px-2">{content}</span>
              ) : (
                <Link
                  href={`${basePath}/${requestId}?step=${step}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "block rounded-lg px-1 py-2 transition-colors outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 lg:px-2",
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
    </nav>
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
  roomSharing,
  emptyText = "No services selected.",
  className,
}: {
  lines: SummaryLine[];
  total: number;
  currency: string;
  trip: TripShape;
  roomSharing?: RoomSharing;
  emptyText?: string;
  className?: string;
}) {
  const nights = trip.nightsMakkah + trip.nightsMadinah;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-xs", className)}>
      <h2 className="font-heading text-base font-bold">Your Umrah price</h2>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {trip.numPilgrims} traveller{trip.numPilgrims > 1 ? "s" : ""} · {nights} night
        {nights === 1 ? "" : "s"} ({trip.nightsMakkah} Makkah / {trip.nightsMadinah} Madinah)
        {roomSharing ? ` · ${ROOM_SHARING_LABELS[roomSharing]} room` : null}
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
                  <category.icon className="size-3.5 text-primary" aria-hidden />
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
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(line.unitPrice, currency)} × {line.quantity}
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
        <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
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
export function TripNotFoundRecovery({
  error,
  basePath = "/umrah/private",
}: {
  error: string | null | undefined;
  basePath?: string;
}) {
  if (error !== REQUEST_NOT_EDITABLE_ERROR) return null;
  return (
    <Button render={<Link href={basePath} />} variant="outline" size="sm" className="gap-1.5">
      Start a new private trip <ArrowRight className="size-3.5" aria-hidden />
    </Button>
  );
}
