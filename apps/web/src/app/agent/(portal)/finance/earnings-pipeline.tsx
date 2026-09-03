import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = { label: string; amount: number; tone: "muted" | "review" | "available" | "paid" };

const TONE_STYLES: Record<Stage["tone"], string> = {
  muted: "text-foreground",
  review: "text-brand-gold",
  available: "text-primary",
  paid: "text-muted-foreground",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

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
    { label: "Paid out", amount: paidOut, tone: "paid" },
  ];

  return (
    <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border sm:flex-row">
      {stages.map((stage, i) => (
        <div key={stage.label} className="relative flex flex-1 items-center gap-2 bg-background px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{stage.label}</p>
            <p className={cn("mt-1 truncate font-heading text-xl font-bold", TONE_STYLES[stage.tone])}>
              {money(stage.amount)}
            </p>
          </div>
          {i < stages.length - 1 ? (
            <ChevronRight
              className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground sm:block"
              aria-hidden
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
