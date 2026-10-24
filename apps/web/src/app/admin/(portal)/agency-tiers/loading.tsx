import { DataTable, LoadingShell, Title } from "@/components/dashboard/admin-skeletons";

export default function AgencyTiersLoading() {
  return (
    <LoadingShell label="agency tiers">
      <Title title="Agency tiers" badge actions={["w-28"]} />
      <DataTable headers={["Tier", "Commission", "Credit limit", "Sort", "Agencies", ""]} rows={4} />
    </LoadingShell>
  );
}
