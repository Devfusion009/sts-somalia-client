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
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Application Steps</p>
      <ol className="mt-4 space-y-1">
        {steps.map((step) => {
          const isCurrent = step === currentStep;
          const isDone = step < currentStep;
          const isLocked = step > maxStep;
          const content = (
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isCurrent ? "bg-primary text-primary-foreground" : isDone ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <Check className="size-3.5" /> : step}
              </span>
              <span className={cn("text-sm font-medium", isCurrent ? "text-primary" : isLocked ? "text-muted-foreground" : "")}>
                {stepLabel(kind, step)}
              </span>
            </span>
          );
          return (
            <li key={step}>
              {isLocked ? (
                <span className="block rounded-lg px-2 py-2 opacity-60">{content}</span>
              ) : (
                <Link
                  href={`/account/become/${kind}/${applicationId}?step=${step}`}
                  className={cn("block rounded-lg px-2 py-2 transition-colors hover:bg-accent/60", isCurrent && "bg-secondary")}
                >
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
