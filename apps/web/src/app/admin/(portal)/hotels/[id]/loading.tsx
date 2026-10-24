import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, LoadingShell, PillCell, RailSkeleton, TabBar } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Rooms", "Bookings", "Managers", "Photos"];

export default function HotelLoading() {
  return (
    <LoadingShell label="hotel" className="space-y-8">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-xl max-sm:size-12" />
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <RailSkeleton labels={RAIL} />
        <TabBar labels={["Overview", "Bookings", "Rates", "Refunds", "Guests", "Reports"]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Photos &amp; media</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Availability</h2>
        <Skeleton className="h-48 w-full rounded-xl" />
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Rooms</h2>
        <DataTable headers={["Room", "Count", "Sleeps", "Price / night", "Status", ""]} rows={4} cell={{ 4: PillCell }} />
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Bookings</h2>
        <DataTable headers={["Customer", "Room", "Dates", "Price", "Pipeline", ""]} rows={4} cell={{ 4: PillCell }} />
      </section>
    </LoadingShell>
  );
}
