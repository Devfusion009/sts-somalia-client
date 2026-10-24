import {
  Chips,
  DataTable,
  LoadingShell,
  PillCell,
  StatStrip,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function TopUpsLoading() {
  return (
    <LoadingShell label="top-ups">
      <Title title="Top-ups" />
      <StatStrip labels={["To review","Credited this month","Declined & failed"]} />
      <Chips counts labels={["To review","Credited","Declined & failed","All"]} />
      <DataTable headers={["Agency","Amount","Requested","Evidence","Status",""]} rows={8} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
