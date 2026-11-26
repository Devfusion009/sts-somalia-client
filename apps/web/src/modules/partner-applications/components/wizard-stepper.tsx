import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { stepsFor, stepLabel, type ApplicationKind } from "../config";

export function WizardStepper({
  kind,
  applicationId,
  currentStep,
  maxStep,
}: {
  kind: ApplicationKind;
  applicationId: string;
  currentStep: number;
  maxStep: number;
}) {
  const steps = stepsFor(kind);
  return (
    <aside className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-sm font-semibold">Application progress</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>Step {steps.indexOf(currentStep)+1} of {steps.length}</span><span className="font-medium text-primary">In progress</span></div>
      <div role="progressbar" aria-label="Completed application steps" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.max(0,steps.indexOf(currentStep))} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${Math.max(0,steps.indexOf(currentStep))/steps.length*100}%`}} /></div>
      <ol className="mt-4">
        {steps.map((step, i) => {
          const isCurrent = step === currentStep;
          const isDone = step < currentStep;
          const isLocked = step > maxStep;
          const isLast = i === steps.length - 1;
          const content = (
            <span className="flex items-center gap-3">
              <span className="relative flex shrink-0 flex-col items-center self-stretch">
                <span
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-4",
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-primary/15"
                      : isDone
                        ? "bg-primary text-primary-foreground ring-card"
                        : "bg-muted text-muted-foreground ring-card"
                  )}
                >
                  {isDone ? <Check className="size-4" aria-hidden="true" /> : step}
                </span>
                {isLast ? null : (
                  <span className={cn("w-px flex-1", isDone ? "bg-primary" : "bg-border")} />
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isLast ? "pb-1" : "pb-8",
                  isCurrent ? "font-semibold text-foreground" : isLocked ? "font-medium text-muted-foreground" : "font-medium text-foreground/80"
                )}
              >
                {stepLabel(kind, step)}
                <span className="sr-only">{isCurrent ? " (current)" : isDone ? " (done)" : isLocked ? " (locked)" : ""}</span>
              </span>
            </span>
          );
          return (
            <li key={step} aria-current={isCurrent ? "step" : undefined}>
              {isLocked ? (
                <span className="block opacity-60">{content}</span>
              ) : (
                <Link href={`/account/become/${kind}/${applicationId}?step=${step}`} className="block rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
