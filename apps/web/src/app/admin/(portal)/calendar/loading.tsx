import { Skeleton } from "@/components/ui/skeleton";
import { TopProgressBar } from "@/components/dashboard/skeletons";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Which cells carry placeholder event bars, so the grid reads as a busy month rather than an empty one. */
const BUSY_CELLS: Record<number, number> = { 3: 1, 5: 2, 9: 1, 11: 1, 12: 2, 16: 1, 19: 2, 23: 1, 24: 1, 27: 2, 31: 1, 36: 1 };

/**
 * Calendar-shaped fallback for /admin/calendar: the title, month controls and
 * legend row, then a seven-column month grid, so the page settles in place
 * when the bookings arrive.
 */
export default function CalendarLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading calendar" className="space-y-6">
      <TopProgressBar />

      <Skeleton className="h-8 w-56" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          {[24, 20, 16, 16, 16, 20].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-b-0 border-border bg-border text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="bg-muted/60 px-2 py-2 text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-b-lg border border-border bg-border">
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className="min-h-[7.5rem] space-y-2 bg-card p-2">
              <Skeleton className="h-3.5 w-5" />
              {Array.from({ length: BUSY_CELLS[i] ?? 0 }, (_, bar) => (
                <Skeleton key={bar} className="h-5 w-full rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
