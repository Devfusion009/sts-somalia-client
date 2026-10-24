import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  EntityHead,
  FormFields,
  LoadingShell,
  PillCell,
  RailSkeleton,
  StatStrip,
} from "@/components/dashboard/admin-skeletons";

const CONTROLS = ["Commission rate", "Credit limit", "Low-balance alert"];

export default function AgencyLoading() {
  return (
    <LoadingShell label="agency" className="space-y-8">
      <div className="space-y-5">
        <EntityHead logo />
        <RailSkeleton
          labels={["Wallet balance", "Credit limit", "Available", "Commission", "Total earned", "Members"]}
          className="sm:grid-cols-3 lg:grid-cols-6"
        />
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Performance</h2>
          <Skeleton className="h-8 w-72 max-w-full rounded-lg" />
        </div>
        <StatStrip labels={["Tickets cut", "Sales", "Agency earned", "Customers"]} />
        <Skeleton className="h-72 w-full rounded-xl" />
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Account controls</h2>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CONTROLS.map((title) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-sm">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <FormFields labels={[" "]} button="Save" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Members</h2>
          <DataTable headers={["Name", "Role", "Status"]} rows={3} cell={{ 2: PillCell }} />
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Markup rules</h2>
          <DataTable headers={["Applies to", "Markup"]} rows={3} />
        </section>
      </div>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Wallet transactions</h2>
        <DataTable headers={["Date", "Type", "Order", "Note", "Amount", "Balance after"]} rows={5} />
      </section>
    </LoadingShell>
  );
}
