import { CheckCircle2, Circle, ShieldCheck, EyeOff } from "lucide-react";
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
    <Card className="border-brand-gold/40 bg-brand-gold/5 shadow-sm">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Onboarding</p>
              <p className="text-xs text-muted-foreground">
                {doneCount} of {checklist.length} steps done
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5 border-transparent bg-brand-gold/15 text-brand-gold">
            <EyeOff className="size-3.5" /> Not visible to customers yet
          </Badge>
        </div>
        <Progress value={percent} />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(item.done ? "text-muted-foreground line-through" : "text-foreground")}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
