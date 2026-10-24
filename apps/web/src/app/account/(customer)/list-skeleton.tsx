import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const WIDTHS = ["w-2/3", "w-1/2", "w-3/5", "w-3/4", "w-2/5"];

/** Placeholder for the account pages' divide-y list cards (icon, two lines, status + amount). */
export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={`h-4 ${WIDTHS[i % WIDTHS.length]}`} />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
