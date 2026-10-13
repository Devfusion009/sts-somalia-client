import {
  Chips,
  LoadingShell,
  OrderCards,
  Pager,
  StatTiles,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function OrdersLoading() {
  return (
    <LoadingShell label="orders">
      <Title title="Orders &amp; Payments" />
      <StatTiles labels={["Orders","Settled revenue","Awaiting confirmation","Travelling within 30 days"]} />
      <Chips counts labels={["All","Needs action","Travelling soon","Unpaid","Partially paid","Paid","Cancelled"]} />
      <OrderCards rows={3} />
      <Pager />
    </LoadingShell>
  );
}
