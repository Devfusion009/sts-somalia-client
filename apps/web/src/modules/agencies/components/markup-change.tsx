import { ArrowRight, BedDouble, FileBadge2, Layers, MoonStar, PartyPopper, Plane, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markupLabel, scopeLabel } from "../markup-labels";

type Rule = { markup_type: string; value: number | string | null };

const SCOPE_ICONS: Record<string, LucideIcon> = {
  hotel: BedDouble,
  flight: Plane,
  visa: FileBadge2,
  umrah: MoonStar,
  hall: PartyPopper,
};

/** Which rule a request targets — the agency-wide default or one vertical. */
export function ScopeBadge({ itemType, className }: { itemType: string | null; className?: string }) {
  const Icon = (itemType && SCOPE_ICONS[itemType]) || Layers;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium",
        itemType === null ? "bg-secondary text-foreground" : "bg-primary/10 text-primary",
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {scopeLabel(itemType)}
    </span>
  );
}

/**
 * Before/after tiles for one markup request — what is live now versus what
 * the agency is asking for. For a vertical with no rule of its own, the
 * agency-wide default is what actually applies today, so pass it as
 * `fallback` and the Current tile shows that rate (labelled as the default)
 * instead of a misleading "No rule". Server-safe (no client directive) so
 * the admin queue and the agency detail page can both render it.
 */
export function MarkupChange({
  current,
  fallback,
  request,
  className,
}: {
  current: Rule | null | undefined;
  fallback?: Rule | null;
  request: { action: string; markup_type: string; value: number | string | null };
  className?: string;
}) {
  const isRemove = request.action === "remove";
  const effective = current ?? fallback ?? null;
  const currentLabel = current ? "Current" : fallback ? "Current · default" : "Current";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="min-w-24 rounded-lg bg-muted/60 px-3 py-1.5">
        <p className="text-xs text-muted-foreground">{currentLabel}</p>
        <p className="font-heading text-base font-semibold text-muted-foreground tabular-nums">
          {effective ? markupLabel(effective.markup_type, effective.value) : "No rule"}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
      <div className={cn("min-w-24 rounded-lg px-3 py-1.5", isRemove ? "bg-destructive/10" : "bg-primary/10")}>
        <p className={cn("text-xs", isRemove ? "text-destructive" : "text-primary")}>Requested</p>
        <p
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            isRemove ? "text-destructive" : "text-primary"
          )}
        >
          {isRemove ? "Remove" : markupLabel(request.markup_type, request.value)}
        </p>
      </div>
    </div>
  );
}
