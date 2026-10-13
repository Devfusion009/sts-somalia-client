import {
  Chips,
  DataTable,
  LoadingShell,
  Pager,
  PillCell,
  SearchBar,
  StatTiles,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function ApplicationsLoading() {
  return (
    <LoadingShell label="applications">
      <Title title="Partner Applications" />
      <StatTiles className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" labels={["All Applications","Travel Agent","Hotel Partner","Affiliate","Event Venue Partner"]} />
      <Chips size="sm" counts labels={["All","Pending","Under review","More info requested","Approved","Rejected"]} />
      <SearchBar placeholder="Search applications" selects={1} />
      <DataTable headers={["Application ID","Partner","Type","Contact","Submitted","Status","Actions"]} rows={8} cell={{ 5: PillCell }} />
      <Pager />
    </LoadingShell>
  );
}
