import { cn } from "@/lib/utils";

/**
 * At-a-glance rail under an entity detail header (hotel, venue, package,
 * departure, booking): label/value pairs in one `bg-secondary/40` strip.
 * `StatStrip` (filter-chips.tsx) is the card-surfaced variant for list pages.
 */
export function StatRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2",
        className
      )}
    >
      {children}
    </dl>
  );
}

export function StatRailItem({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "warn" | "primary" | "destructive";
}) {
  return (
    <div className="min-w-0 bg-secondary/40 px-4 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate font-heading text-lg font-semibold tabular-nums",
          tone === "warn" && "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold",
          tone === "primary" && "text-primary",
          tone === "destructive" && "text-destructive"
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="truncate text-xs text-muted-foreground tabular-nums">{sub}</dd> : null}
    </div>
  );
}
