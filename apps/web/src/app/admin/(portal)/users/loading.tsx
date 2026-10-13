import {
  DataTable,
  LoadingShell,
  Pager,
  PillCell,
  SearchBar,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function UsersLoading() {
  return (
    <LoadingShell label="users">
      <Title title="Users" badge />
      <SearchBar placeholder="Name or email" />
      <DataTable headers={["Name","Email","Role","Status","Joined","Actions"]} rows={10} cell={{ 3: PillCell }} />
      <Pager />
    </LoadingShell>
  );
}
