import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterChip = {
  key: string;
  label: string;
  href: string;
  /** Omitted or 0 hides the count unless `showZero` is set. */
  count?: number;
};

/**
 * Link-driven filter pills for list pages. Scrolls sideways on phones rather
 * than wrapping into a tall block above the list.
 */
export function FilterChips({
  items,
  active,
  label,
  showZero = false,
  className,
}: {
  items: FilterChip[];
  active: string;
  /** Accessible name of the nav, e.g. "Filter orders". */
  label: string;
  showZero?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const showCount = item.count !== undefined && (showZero || item.count > 0);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-10",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {item.label}
            {showCount ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Divided stat strip for finance/list pages; pairs with the `StatStrip` skeleton. */
export function StatStrip({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-xs ring-1 ring-foreground/[0.08]",
        cols === 3 ? "sm:grid-cols-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2" : "lg:grid-cols-4"
      )}
    >
      {children}
    </dl>
  );
}

export function StatStripItem({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "warn" | "primary";
}) {
  return (
    <div className="min-w-0 bg-card p-4">
      <dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-2 truncate font-heading text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          tone === "warn" && "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold",
          tone === "primary" && "text-primary"
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">{sub}</dd> : null}
    </div>
  );
}
