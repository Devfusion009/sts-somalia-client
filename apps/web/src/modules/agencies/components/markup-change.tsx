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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium",
        itemType === null ? "bg-secondary text-foreground" : "bg-primary/10 text-primary",
        className
      )}
    >
      <Icon className="size-3.5" />
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
      <div className="min-w-28 rounded-lg border border-border bg-muted/40 px-4 py-2 text-center">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{currentLabel}</p>
        <p className="text-xl font-semibold text-muted-foreground">
          {effective ? markupLabel(effective.markup_type, effective.value) : "No rule"}
        </p>
      </div>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.5} />
      <div
        className={cn(
          "min-w-28 rounded-lg border px-4 py-2 text-center",
          isRemove ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
        )}
      >
        <p className={cn("text-[10px] font-medium tracking-wide uppercase", isRemove ? "text-destructive" : "text-primary")}>
          Requested
        </p>
        <p className={cn("text-2xl font-bold", isRemove ? "text-destructive" : "text-primary")}>
          {isRemove ? "Remove" : markupLabel(request.markup_type, request.value)}
        </p>
      </div>
    </div>
  );
}
