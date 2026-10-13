import {
  DataTable,
  LoadingShell,
  PillCell,
  StatTiles,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function AgingReportLoading() {
  return (
    <LoadingShell label="aging report">
      <Title title="Aging Report" actions={["w-32"]} />
      <StatTiles className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-4" labels={["0-7 days","8-30 days","31-60 days","60+ days"]} />
      <DataTable headers={["Agency","Outstanding","Aging Since","Days","Bucket"]} rows={8} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
