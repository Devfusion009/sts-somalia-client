import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, LoadingShell, PillCell } from "@/components/dashboard/admin-skeletons";

export default function VisaCentresLoading() {
  return (
    <LoadingShell label="visa centres">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Application centres</h1>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <DataTable headers={["Centre", "Location", "Hours", "Visa types", "Status", ""]} rows={6} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
