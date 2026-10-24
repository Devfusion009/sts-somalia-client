import { CheckCircle2, Circle, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ChecklistItem = { key: string; label: string; description: string; done: boolean };

/**
 * The portal itself never explained that "onboarding" ≠ "fully live" — a
 * partner could navigate the whole portal with no signal they were still
 * mid-review, while nothing they created could go live anyway (see the
 * partner-facing status enum in partner-actions.ts: publishing is
 * admin-only). This makes that state visible where the partner actually
 * is, not just on the admin console they can't see — as a status badge, not
 * caption prose: the checklist already shows what's left, so the one fact
 * worth adding is what the incomplete state means for visibility.
 */
export function OnboardingStatusBanner({ checklist }: { checklist: ChecklistItem[] }) {
  const doneCount = checklist.filter((i) => i.done).length;
  if (doneCount === checklist.length) return null;
  const percent = Math.round((doneCount / checklist.length) * 100);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-2">
            <p className="font-heading text-sm font-semibold">Onboarding</p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneCount} of {checklist.length}
            </span>
          </div>
          <Badge variant="warning" className="gap-1.5">
            <EyeOff aria-hidden="true" /> Not visible to customers yet
          </Badge>
        </div>
        <Progress value={percent} aria-label={`Onboarding ${doneCount} of ${checklist.length} done`} />
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={cn(item.done ? "text-muted-foreground line-through" : "text-foreground")}>
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
