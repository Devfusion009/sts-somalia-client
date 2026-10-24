import {
  Chips,
  DataTable,
  LoadingShell,
  PillCell,
  StatStrip,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function WithdrawalsLoading() {
  return (
    <LoadingShell label="withdrawals">
      <Title title="Withdrawals" />
      <StatStrip labels={["To review","Cleared to pay","In transit","Paid this month"]} />
      <Chips counts labels={["Open","To review","To pay","In transit","Paid","Declined & failed"]} />
      <DataTable headers={["Agency","Amount","Requested","Destination","Status",""]} rows={8} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
