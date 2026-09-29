import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

/**
 * Stat card: label with a small muted icon, value, optional period-over-period
 * delta, trend sparkline, and a footer slot for a breakdown line (e.g. markup
 * vs. commission). Server-renderable — only the Sparkline it wraps needs to
 * be a Client Component.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  series,
  href,
  footer,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  /** Retained for callers; the card no longer paints a tinted icon tile. */
  tint?: string;
  /** Percent change vs. the prior period of equal length. null = no baseline to compare against. */
  change?: number | null;
  series?: number[];
  href?: string;
  footer?: ReactNode;
}) {
  const body = (
    <Card className={cn("h-full", href && "transition-shadow group-hover:shadow-md")}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </p>
            <p className="mt-2 truncate font-heading text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
              {change === null || change === undefined ? null : change === 0 ? (
                <span className="text-xs font-medium text-muted-foreground">Steady</span>
              ) : (
                <span className={cn("text-xs font-medium", change > 0 ? "text-primary" : "text-destructive")}>
                  {change > 0 ? "↑" : "↓"} {Math.abs(change)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 self-end">
            {series && series.length > 1 ? <Sparkline data={series} positive={(change ?? 0) >= 0} /> : null}
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
