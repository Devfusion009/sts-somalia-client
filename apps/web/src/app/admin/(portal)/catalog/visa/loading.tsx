import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function VisaCatalogLoading() {
  return (
    <LoadingShell label="visa catalog">
      <Title title="Visa Catalog" actions={["w-44","w-36"]} />
      <DataTable headers={["Destination","Name","Price","Status","Actions"]} rows={8} cell={{ 3: PillCell }} />
    </LoadingShell>
  );
}
