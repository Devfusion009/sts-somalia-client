import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function RefundsLoading() {
  return (
    <LoadingShell label="refunds">
      <Title title="Refund Requests" />
      <DataTable heading="Customer requests" headers={["Requested","Customer","Order","Type","Reason","Amount","Status",""]} rows={3} cell={{ 6: PillCell }} />
      <DataTable heading="Agency requests" headers={["Requested","Agency","Order","Reason","Amount",""]} rows={3} />
      <DataTable heading="Recently reviewed" headers={["Reviewed","Agency","Order","Amount","Status","Notes"]} rows={5} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
