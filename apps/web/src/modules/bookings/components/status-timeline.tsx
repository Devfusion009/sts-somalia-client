import type { LucideIcon } from "lucide-react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic progress timeline for anything that moves through fixed stages.
 *
 * The visa tracking page keeps its own bespoke timeline: it inserts and removes
 * an "Additional Documents" stage depending on whether staff ever asked for
 * one, and rewriting it to fit a generic component would risk a working,
 * customer-facing flow for cosmetic consistency. This one serves Umrah bookings
 * and order itineraries, whose stages are fixed.
 */

export type TimelineStage = {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
};

export function StatusTimeline({
  stages,
  currentIndex,
  outcome = "pending",
}: {
  stages: TimelineStage[];
  /** Index of the stage currently reached. Stages before it render as done. */
  currentIndex: number;
  /**
   * How the FINAL stage resolved. Only meaningful once currentIndex reaches the
   * last stage — a rejected booking has to look different from an approved one
   * even though both sit at the end of the same track.
   */
  outcome?: "pending" | "success" | "failed";
}) {
  const lastIndex = stages.length - 1;

  return (
    <ol
      // Vertical on mobile (a five-stage horizontal track is unreadable at
      // 390px), horizontal from sm up.
      className="flex flex-col gap-0 sm:flex-row sm:gap-0"
    >
      {stages.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFinal = index === lastIndex;
        const failed = isCurrent && isFinal && outcome === "failed";
        const succeeded = isCurrent && isFinal && outcome === "success";

        const Icon = failed ? X : isDone || succeeded ? Check : stage.icon;

        return (
          <li
            key={stage.key}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex flex-1 gap-3 pb-5 last:pb-0 sm:flex-col sm:gap-0 sm:pb-0"
          >
            {/* Connector. Drawn behind the marker and inset by its radius so it
                meets the circle's edge instead of running under it. */}
            {index < lastIndex ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-4 top-9 h-[calc(100%-2.25rem)] w-0.5 -translate-x-1/2 sm:left-auto sm:top-4 sm:h-0.5 sm:w-full sm:translate-x-4 sm:-translate-y-1/2",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                failed
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : isDone || succeeded
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-border bg-background text-muted-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 pt-1.5 sm:mt-2 sm:pt-0 sm:pr-4">
              <p
                className={cn(
                  "text-sm font-medium",
                  isCurrent && "font-semibold",
                  failed
                    ? "text-destructive"
                    : isDone || isCurrent
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {stage.label}
                <span className="sr-only">
                  {failed ? " (stopped)" : isDone || succeeded ? " (done)" : isCurrent ? " (current)" : " (upcoming)"}
                </span>
              </p>
              {stage.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{stage.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
