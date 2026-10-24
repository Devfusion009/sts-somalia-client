import { Skeleton } from "@/components/ui/skeleton";
import { Chips, DataTable, LoadingShell, PillCell, RailSkeleton } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Seats", "Booked", "Offline", "Free", "Bookings", "Pilgrims ready", "Outstanding"];

export default function UmrahDepartureLoading() {
  return (
    <LoadingShell label="Umrah departure" className="space-y-8">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <RailSkeleton labels={RAIL} className="lg:grid-cols-7" />
      </div>
      <Chips labels={["Manifest", "Rooming"]} />
      <DataTable
        headers={["Pilgrim", "Booking", "Passport", "Readiness", "Rooms", "Balance", "Stage", ""]}
        rows={8}
        cell={{ 3: PillCell, 6: PillCell }}
      />
    </LoadingShell>
  );
}
