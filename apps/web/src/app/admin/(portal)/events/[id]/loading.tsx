import { Skeleton } from "@/components/ui/skeleton";

export default function VenueLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading venue">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-none" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 w-full lg:col-span-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
