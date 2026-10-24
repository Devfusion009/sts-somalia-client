import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DataTable, LoadingShell, PillCell, Title } from "@/components/dashboard/admin-skeletons";

const RAIL = [
  "Needs action",
  "Unassigned",
  "Due within 24h",
  "Awaiting payment",
  "Waiting on applicant",
  "Processing",
  "Passport return",
];

const GROUPS = [
  { label: "My work", queues: ["Needs action", "Assigned to me", "Unassigned", "Due within 24h"] },
  {
    label: "In progress",
    queues: ["Awaiting payment", "New", "Document review", "Waiting on applicant", "Appointment pending", "Ready for submission", "Processing"],
  },
  { label: "Closed", queues: ["Approved", "Passport return", "Refused", "Issued", "Cancelled", "All"] },
];

export default function VisaApplicationsLoading() {
  return (
    <LoadingShell label="visa applications">
      <Title title="Visa applications" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4 lg:grid-cols-7">
        {RAIL.map((label, i) => (
          <div key={label} className={cn("flex min-w-0 flex-col gap-0.5 px-4 py-3", i === 0 ? "bg-card" : "bg-secondary/40")}>
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <Skeleton className="mt-1 h-6 w-8" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className="shrink-0 text-xs text-muted-foreground sm:w-24">{group.label}</span>
            <div className="-mx-4 flex gap-1.5 overflow-hidden px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {group.queues.map((q, i) => (
                <span
                  key={q}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap max-sm:h-9",
                    group.label === "My work" && i === 0
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {q}
                  <Skeleton className="h-3.5 w-4" />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full rounded-lg sm:w-72" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <DataTable
        headers={["Applicant", "Destination", "Stage", "Payment", "Docs", "Appointment", "Owner", "In stage", "Due", ""]}
        rows={8}
        cell={{ 2: PillCell, 3: PillCell }}
      />
    </LoadingShell>
  );
}
