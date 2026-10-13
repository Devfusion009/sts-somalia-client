import {
  DataTable,
  LoadingShell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function AgencyTiersLoading() {
  return (
    <LoadingShell label="agency tiers">
      <Title title="Agency Tiers" actions={["w-32"]} />
      <DataTable headers={["Tier","Default Commission","Default Credit Limit","Sort","Agencies","Manage"]} rows={4} />
    </LoadingShell>
  );
}
