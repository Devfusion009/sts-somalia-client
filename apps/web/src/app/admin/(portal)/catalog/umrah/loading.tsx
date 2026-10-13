import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function UmrahCatalogLoading() {
  return (
    <LoadingShell label="Umrah catalog">
      <Title title="Umrah Catalog" actions={["w-36"]} />
      <DataTable headers={["Name","Duration","Price","Departures","Status","Actions"]} rows={8} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
