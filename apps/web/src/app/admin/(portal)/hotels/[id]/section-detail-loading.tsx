import { Skeleton } from "@/components/ui/skeleton";
import { RailSkeleton } from "@/components/dashboard/admin-skeletons";
import { HotelSectionLoading } from "./section-loading";

/** Booking and guest detail: back button, name + badges, a fact rail, then cards. */
export function HotelDetailLoading({ label, rail }: { label: string; rail: string[] }) {
  return (
    <HotelSectionLoading label={label}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <RailSkeleton labels={rail} className="sm:grid-cols-3 lg:grid-cols-6" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </HotelSectionLoading>
  );
}
