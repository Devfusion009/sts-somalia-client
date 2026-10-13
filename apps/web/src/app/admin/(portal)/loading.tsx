import { Skeleton } from "@/components/ui/skeleton";
import { PanelPairSkeleton, StatRowSkeleton, TopProgressBar } from "@/components/dashboard/skeletons";

/**
 * Fallback for every admin route while its server data resolves. The thin
 * top bar signals navigation in progress; the skeleton mirrors the console
 * layout (title row, stat rail, panels) so content settles in place.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <TopProgressBar />

      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-72 rounded-lg" />
        </div>
        <StatRowSkeleton />
        <PanelPairSkeleton />
        <PanelPairSkeleton rows={4} />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
