import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SecureDataNote } from "./visa-shared";

export const WIZARD_STEPS = [
  { step: 1, label: "Applicant & Family Type", hint: "Who is applying" },
  { step: 2, label: "Personal Information", hint: "Enter your personal details" },
  { step: 3, label: "Travel Information", hint: "Enter your travel details" },
  { step: 4, label: "Document Upload", hint: "Upload required documents" },
  { step: 5, label: "Review Application", hint: "Review your application" },
  { step: 6, label: "Payment", hint: "Make payment securely" },
  { step: 7, label: "Result & Tracking", hint: "Track your application" },
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
}: {
  applicationId: string;
  currentStep: number;
  maxStep: number;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Visa Application Steps
        </p>
        <ol className="mt-4 space-y-1">
          {WIZARD_STEPS.map(({ step, label, hint }) => {
            const isCurrent = step === currentStep;
            const isDone = step < currentStep || (step <= maxStep && step < 6 && !isCurrent);
            const isLocked = step > maxStep || step >= 6;
            const marker = isDone ? (
              <Check className="size-3.5" />
            ) : isLocked && step >= 6 ? (
              <Lock className="size-3" />
            ) : (
              step
            );

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
                    {isCurrent ? "In Progress" : isDone ? "Completed" : hint}
                  </span>
                </span>
              </span>
            );

            return (
              <li key={step} className="relative">
                {step < WIZARD_STEPS.length ? (
                  <span
                    aria-hidden
                    className="absolute top-8 left-3 h-[calc(100%-1.25rem)] w-px bg-border"
                  />
                ) : null}
                {isLocked ? (
                  <span className="block rounded-lg px-2 py-2">{content}</span>
                ) : (
                  <Link
                    href={`/visa/apply/${applicationId}?step=${step}`}
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
      </div>
      <SecureDataNote />
    </aside>
  );
}
