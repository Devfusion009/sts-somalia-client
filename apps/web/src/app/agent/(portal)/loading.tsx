import { Skeleton } from "@/components/ui/skeleton";
import { PanelPairSkeleton, TopProgressBar } from "@/components/dashboard/skeletons";

export default function AgentLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-6">
      <TopProgressBar />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <PanelPairSkeleton />
      <span className="sr-only">Loading</span>
    </div>
  );
}
