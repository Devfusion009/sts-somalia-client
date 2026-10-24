import { Skeleton } from "@/components/ui/skeleton";
import { RailSkeleton } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Events today", "Next 7 days", "Open requests", "Awaiting payment", "Booked this month"];

export default function VenueLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading venue" className="space-y-6">
      <RailSkeleton labels={RAIL} className="sm:grid-cols-5" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
