import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function AgenciesLoading() {
  return (
    <LoadingShell label="agencies">
      <Title title="Agencies" badge />
      <DataTable
        headers={["Agency", "Status", "Tier", "Commission", "Balance", "Credit limit", "Members", ""]}
        rows={8}
        cell={{ 1: PillCell }}
      />
    </LoadingShell>
  );
}
