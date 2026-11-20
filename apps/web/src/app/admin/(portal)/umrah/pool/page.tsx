import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { UmrahPackageForm } from "../../catalog/umrah/umrah-package-form";
import { poolCapacity, type UmrahPoolRow } from "@/modules/umrah/pool";
import { PoolList } from "./pool-list";

export const metadata = { title: "Umrah pool" };

export default async function UmrahPoolPage() {
  await requirePlatformAdmin();
  const client = await createClient();
  const [{ data, error }, airports, requestFirstEnabled] = await Promise.all([
    client.rpc("admin_public_umrah_pool"),
    (await getServerTrpc()).flights.airports.query(),
    (await getServerTrpc()).umrah.poolRequests.enabled.query(),
  ]);
  if (error) throw new Error("Umrah pool could not be loaded.");
  const rows = (data ?? []) as unknown as UmrahPoolRow[];
  const totals = rows.reduce((sum,row) => { const c=poolCapacity(row); return {total:sum.total+c.total,filled:sum.filled+c.filled,held:sum.held+c.held,remaining:sum.remaining+c.remaining}; }, {total:0,filled:0,held:0,remaining:0});
  return <div className="space-y-6">
    <PageHeader title="Umrah pool" actions={<UmrahPackageForm airports={airports} requestFirstEnabled={requestFirstEnabled} />} />
    <StatRail><StatRailItem label="Total capacity" value={totals.total} /><StatRailItem label="Filled" value={totals.filled} /><StatRailItem label="Held" value={totals.held} /><StatRailItem label="Remaining" value={totals.remaining} /></StatRail>
    <PoolList rows={rows} />
  </div>;
}
