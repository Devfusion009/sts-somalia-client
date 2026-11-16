import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Chips, DataTable, LoadingShell, PillCell, SearchBar, Title } from "@/components/dashboard/admin-skeletons";

export default function VisaApplicationsLoading() {
  return (
    <LoadingShell label="visa applications">
      <Title title="Visa applications" actions={["w-24"]} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {["All applications", "Needs action", "Awaiting payment", "Document review"].map((label, i) => (
          <div key={label} className={cn("flex min-w-0 flex-col gap-0.5 px-4 py-3", i === 0 ? "bg-card" : "bg-secondary/40")}>
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <Skeleton className="mt-1 h-6 w-8" />
          </div>
        ))}
      </div>
      <Chips counts labels={["All applications", "Awaiting payment", "Ready for review", "Document review", "Waiting on applicant", "Processing"]} />
      <div className="rounded-xl border border-border bg-card p-4 text-sm font-medium">More queues</div>
      <div className="rounded-xl border border-border bg-card p-4"><SearchBar placeholder="Reference, name, email" selects={3} urgent /></div>
      <div className="flex justify-between"><span className="font-semibold">All applications</span><Skeleton className="h-4 w-36" /></div>
      <DataTable headers={["Applicant", "Destination", "Received", "Stage", "Payment", "Docs", "Owner", ""]} rows={8} cell={{ 3: PillCell, 4: PillCell }} />
    </LoadingShell>
  );
}
