import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function RefundsLoading() {
  return (
    <LoadingShell label="refunds">
      <Title title="Refund Requests" className="font-bold" />
      <DataTable heading="Pending" headers={["Requested","Agency","Order","Reason","Amount","Actions"]} rows={4} />
      <DataTable heading="Recently reviewed" headers={["Reviewed","Agency","Order","Amount","Status","Notes"]} rows={5} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
