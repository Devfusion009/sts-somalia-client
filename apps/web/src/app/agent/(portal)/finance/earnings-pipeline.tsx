import { AgentMoney } from "@/components/portal/agent-money";
import { ChevronRight } from "lucide-react";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

type Stage = { label: string; amount: number; tone: "muted" | "review" | "available" | "paid" };

const TONE_STYLES: Record<Stage["tone"], string> = {
  muted: "text-foreground",
  review: "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold",
  available: "text-primary",
  paid: "text-muted-foreground",
};


/**
 * The four states a booking's commission passes through, laid out in the
 * order it actually moves — earned on a paid booking, held while STS
 * reviews it, released as withdrawable, then gone once transferred. Shown
 * as a rail rather than four unrelated stat cards precisely because the
 * sequence is the thing an agent needs to understand: money that isn't in
 * "Available" yet is not missing, it is upstream.
 */
export function EarningsPipeline({
  totalEarned,
  inReview,
  available,
  paidOut,
}: {
  totalEarned: number;
  inReview: number;
  available: number;
  paidOut: number;
}) {
  const stages: Stage[] = [
    { label: "Total earned", amount: totalEarned, tone: "muted" },
    { label: "In review by STS", amount: inReview, tone: "review" },
    { label: "Available to withdraw", amount: available, tone: "available" },
    { label: "Withdrawn or transferred", amount: paidOut, tone: "paid" },
  ];

  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-xs ring-1 ring-foreground/[0.08] lg:grid-cols-4">
      {stages.map((stage, i) => (
        <li key={stage.label} className="relative min-w-0 bg-card p-4">
          <p className="truncate text-xs font-medium text-muted-foreground">{stage.label}</p>
          <p
            className={cn(
              "mt-2 truncate font-heading text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
              TONE_STYLES[stage.tone]
            )}
          >
            {<AgentMoney value={money(stage.amount, "USD")} />}
          </p>
          {i < stages.length - 1 ? (
            <ChevronRight
              className="absolute top-1/2 -right-2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground ring-1 ring-border lg:block"
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
