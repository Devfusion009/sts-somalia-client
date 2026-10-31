import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const WIZARD_STEPS = [
  { step: 1, label: "Applicant type" },
  { step: 2, label: "Personal information" },
  { step: 3, label: "Travel information" },
  { step: 4, label: "Documents" },
  { step: 5, label: "Review" },
  { step: 6, label: "Payment" },
  { step: 7, label: "Tracking" },
] as const;

/**
 * The left rail of the wizard. Steps at or below `maxStep` are navigable;
 * later ones are locked. Steps 6–7 happen outside the wizard (checkout and
 * the account tracking page) and are always shown locked here.
 */
export function WizardStepper({
  applicationId,
  currentStep,
  maxStep,
  basePath = "/visa/apply",
}: {
  applicationId: string;
  currentStep: number;
  maxStep: number;
  /** Desk host passes "/agent/book/visa/apply" — same steps, portal-hosted. */
  basePath?: string;
}) {
  const current = WIZARD_STEPS.find((s) => s.step === currentStep) ?? WIZARD_STEPS[0];

  const stateOf = (step: number) => {
    const isCurrent = step === currentStep;
    const isDone = step < currentStep || (step <= maxStep && step < 6 && !isCurrent);
    const isLocked = step > maxStep || step >= 6;
    return { isCurrent, isDone, isLocked };
  };

  const markerClass = (isCurrent: boolean, isDone: boolean) =>
    cn(
      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
      isCurrent
        ? "bg-primary text-primary-foreground ring-4 ring-primary/10"
        : isDone
          ? "bg-primary/15 text-primary"
          : "border border-border bg-card text-muted-foreground"
    );

  const markerFor = (step: number, isDone: boolean, isLocked: boolean) =>
    isDone ? (
      <Check className="size-3.5" aria-hidden />
    ) : isLocked && step >= 6 ? (
      <Lock className="size-3" aria-hidden />
    ) : (
      step
    );

  const stateText = (isCurrent: boolean, isDone: boolean, isLocked: boolean) =>
    isCurrent ? "current step" : isDone ? "completed" : isLocked ? "locked" : null;

  return (
    <nav aria-label="Application steps" className="min-w-0">
      {/* Phones/tablets: current step + a row of step markers. */}
      <div className="rounded-2xl border border-border bg-card p-5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-sm font-semibold">{current.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{current.step} / {WIZARD_STEPS.length}</span>
        </div>
        <ol className="mt-5 flex items-center gap-1.5">
          {WIZARD_STEPS.map(({ step, label }) => {
            const { isCurrent, isDone, isLocked } = stateOf(step);
            const text = stateText(isCurrent, isDone, isLocked);
            const marker = (
              <span className={markerClass(isCurrent, isDone)}>
                {markerFor(step, isDone, isLocked)}
                <span className="sr-only">
                  {label}
                  {text ? `, ${text}` : ""}
                </span>
              </span>
            );
            return (
              <li key={step} className="flex flex-1 items-center gap-1.5 last:flex-none">
                {isLocked ? (
                  marker
                ) : (
                  <Link
                    href={`${basePath}/${applicationId}?step=${step}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {marker}
                  </Link>
                )}
                {step < WIZARD_STEPS.length ? (
                  <span aria-hidden className={cn("h-px flex-1", isDone ? "bg-primary/40" : "bg-border")} />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* lg: the vertical rail. */}
      <div className="hidden rounded-2xl border border-border bg-card p-5 lg:block">
        <div className="mb-5 flex items-center justify-between gap-2 border-b border-border pb-4">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Your application</span>
          <span className="text-xs font-semibold text-primary tabular-nums">{current.step} / {WIZARD_STEPS.length}</span>
        </div>
        <ol className="space-y-2">
          {WIZARD_STEPS.map(({ step, label }) => {
            const { isCurrent, isDone, isLocked } = stateOf(step);
            const text = stateText(isCurrent, isDone, isLocked);

            const content = (
              <span className="flex items-center gap-3">
                <span className={markerClass(isCurrent, isDone)}>{markerFor(step, isDone, isLocked)}</span>
                <span
                  className={cn(
                    "min-w-0 truncate text-sm font-semibold",
                    isCurrent ? "text-primary" : isLocked ? "text-muted-foreground" : ""
                  )}
                >
                  {label}
                  {text ? <span className="sr-only">, {text}</span> : null}
                </span>
              </span>
            );

            return (
              <li key={step} className="relative">
                {step < WIZARD_STEPS.length ? (
                  <span aria-hidden className="absolute top-11 left-[1.45rem] h-4 w-px bg-border" />
                ) : null}
                {isLocked ? (
                  <span className="block rounded-xl px-2 py-2.5">{content}</span>
                ) : (
                  <Link
                    href={`${basePath}/${applicationId}?step=${step}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "block rounded-xl px-2 py-2.5 transition-colors outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                      isCurrent && "bg-primary/5"
                    )}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
