import { DataTable, LoadingShell, PillCell, Title } from "@/components/dashboard/admin-skeletons";

export default function PartnersLoading() {
  return (
    <LoadingShell label="partners">
      <Title title="Partner accounts" badge />
      <DataTable
        headers={["Partner", "Type", "Status", "Account ID", "Created", "Went live", ""]}
        rows={8}
        cell={{ 2: PillCell }}
      />
    </LoadingShell>
  );
}
