import { Skeleton } from "@/components/ui/skeleton";
import { Chips, DataTable, LoadingShell, PillCell, Title } from "@/components/dashboard/admin-skeletons";

export default function ApplicationsLoading() {
  return (
    <LoadingShell label="applications">
      <Title title="Partner applications" />
      <div className="space-y-3">
        <Chips counts labels={["All types", "Hotel partner", "Venue partner", "Affiliate", "Travel agency"]} />
        <Chips counts labels={["Any status", "Pending", "Under review", "Awaiting applicant", "Approved", "Rejected"]} />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full rounded-lg sm:w-72" />
          <Skeleton className="h-8 w-80 max-w-full rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <DataTable
        headers={["Reference", "Partner", "Type", "Contact", "Submitted", "Status", ""]}
        rows={8}
        cell={{ 5: PillCell }}
      />
    </LoadingShell>
  );
}
