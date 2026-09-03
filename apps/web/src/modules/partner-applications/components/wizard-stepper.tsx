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
      <p className="text-sm font-semibold">Application Progress</p>
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
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-card",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="size-4" /> : step}
                </span>
                {isLast ? null : (
                  <span className={cn("w-px flex-1", isDone ? "bg-primary" : "bg-border")} />
                )}
              </span>
              <span className={cn("pb-8 text-sm font-medium", isCurrent ? "text-foreground" : isLocked ? "text-muted-foreground" : "text-foreground/80")}>
                {stepLabel(kind, step)}
              </span>
            </span>
          );
          return (
            <li key={step}>
              {isLocked ? (
                <span className="block opacity-60">{content}</span>
              ) : (
                <Link href={`/account/become/${kind}/${applicationId}?step=${step}`} className="block rounded-lg transition-opacity hover:opacity-80">
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
