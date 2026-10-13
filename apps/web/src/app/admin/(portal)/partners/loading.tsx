import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function PartnersLoading() {
  return (
    <LoadingShell label="partners">
      <Title title="Partner Accounts" />
      <DataTable headers={["Account ID","Partner","Type","Status","Created","Went live","Actions"]} rows={8} cell={{ 3: PillCell }} />
    </LoadingShell>
  );
}
