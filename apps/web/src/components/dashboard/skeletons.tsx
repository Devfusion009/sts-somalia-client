import { Skeleton } from "@/components/ui/skeleton";

const CARD = "rounded-xl bg-card shadow-xs ring-1 ring-foreground/[0.08]";

export function StatCardSkeleton() {
  return (
    <div className={`${CARD} flex h-[122px] flex-col justify-between p-5`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex items-end justify-between">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Chart-shaped panel when `rows` is omitted, list-shaped when given. */
export function PanelSkeleton({ className, rows }: { className?: string; rows?: number }) {
  return (
    <div className={`${CARD} p-5 ${className ?? ""}`}>
      <Skeleton className="h-4 w-32" />
      {rows ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      ) : (
        <Skeleton className="mt-5 h-56 w-full rounded-lg" />
      )}
    </div>
  );
}

/** Two panels in the dashboard's 3/5 + 2/5 grid. */
export function PanelPairSkeleton({ rows }: { rows?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <PanelSkeleton className="lg:col-span-3" rows={rows} />
      <PanelSkeleton className="lg:col-span-2" rows={rows} />
    </div>
  );
}

/** Thin indeterminate bar pinned to the top of the viewport while a route loads. */
export function TopProgressBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15" aria-hidden>
      <div className="animate-progress-sweep h-full w-1/4 rounded-full bg-primary" />
    </div>
  );
}
