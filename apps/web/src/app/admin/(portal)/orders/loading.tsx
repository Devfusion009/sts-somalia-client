import {
  Chips,
  LoadingShell,
  OrderCards,
  Pager,
  StatTiles,
  SearchBar,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function OrdersLoading() {
  return (
    <LoadingShell label="orders">
      <Title title="Orders & Payments" actions={["w-24"]} />
      <StatTiles compact labels={["Orders","Settled revenue","Payment requests","Travelling within 30 days"]} />
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <SearchBar placeholder="Order, visa reference, name or email" selects={1} />
      <Chips counts labels={["All","Payment requests","Travelling soon","Unpaid","Partially paid","Paid","Cancelled"]} />
      </div>
      <OrderCards rows={3} />
      <Pager />
    </LoadingShell>
  );
}
