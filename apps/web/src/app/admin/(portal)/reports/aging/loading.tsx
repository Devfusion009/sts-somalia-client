import {
  DataTable,
  LoadingShell,
  PillCell,
  StatStrip,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function AgingReportLoading() {
  return (
    <LoadingShell label="aging report">
      <Title title="Aging Report" actions={["w-32"]} />
      <StatStrip labels={["0-7 days","8-30 days","31-60 days","60+ days"]} />
      <DataTable headers={["Agency","Outstanding","Aging since","Days","Bucket"]} rows={8} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
