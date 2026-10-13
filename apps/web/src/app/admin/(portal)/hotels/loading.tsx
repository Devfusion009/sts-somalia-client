import {
  DataTable,
  LoadingShell,
  Pager,
  PillCell,
  SearchBar,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function HotelsLoading() {
  return (
    <LoadingShell label="hotels">
      <Title title="Hotels" actions={["w-36","w-28"]} />
      <SearchBar placeholder="Hotel or city" selects={1} />
      <DataTable headers={["Hotel","City","Stars","Rooms","Owner","Status","Actions"]} rows={10} cell={{ 5: PillCell }} />
      <Pager />
    </LoadingShell>
  );
}
