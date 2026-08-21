import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ChecklistItem = { key: string; label: string; description: string; done: boolean };

/**
 * The portal itself never explained that "onboarding" ≠ "fully live" — a
 * partner could navigate the whole portal with no signal they were still
 * mid-review, while nothing they created could go live anyway (see the
 * partner-facing status enum in partner-actions.ts: publishing is
 * admin-only). This makes that state visible where the partner actually
 * is, not just on the admin console they can't see.
 */
export function OnboardingStatusBanner({ checklist, portalLabel }: { checklist: ChecklistItem[]; portalLabel: string }) {
  const doneCount = checklist.filter((i) => i.done).length;
  if (doneCount === checklist.length) return null;

  return (
    <Card className="border-brand-gold/40 bg-brand-gold/5">
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-brand-gold" />
            Onboarding — {doneCount}/{checklist.length} complete
          </p>
          <p className="text-xs text-muted-foreground">
            STS reviews and publishes your listings — nothing goes live to customers until then.
          </p>
        </div>
        <Progress value={Math.round((doneCount / checklist.length) * 100)} />
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-start gap-1.5 text-xs">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          You can keep using {portalLabel} while this finishes — it just won&apos;t be visible to real
          customers yet.
        </p>
      </CardContent>
    </Card>
  );
}
