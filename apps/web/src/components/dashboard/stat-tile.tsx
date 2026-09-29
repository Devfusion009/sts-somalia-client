import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The one stat tile for list and overview pages across every portal: label
 * (with an optional small muted icon), value, optional hint. `tone` colours
 * the value only — no tinted icon tiles.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn" | "accent" | "primary";
}) {
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-2 px-4 py-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{label}</span>
        </p>
        <p
          className={cn(
            "truncate font-heading text-2xl leading-none font-semibold tracking-tight tabular-nums",
            tone === "warn" && "text-brand-gold",
            tone === "accent" && "text-brand-accent",
            tone === "primary" && "text-primary"
          )}
        >
          {value}
        </p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
