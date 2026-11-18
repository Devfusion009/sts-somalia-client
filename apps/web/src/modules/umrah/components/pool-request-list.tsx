import Link from "next/link";
import { getServerTrpc } from "@/lib/trpc/server";
import { POOL_REQUEST_LABELS } from "@sts/shared-types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export async function PoolRequestList({ agent = false }: { agent?: boolean }) {
  const rows = await (await getServerTrpc({timeoutMs:15000})).umrah.poolRequests.list.query();
  const requests = rows.filter(r => !r.order_id && (agent ? !!r.agency_id : !r.agency_id));
  if (!requests.length) return null;
  return <Card><CardHeader><CardTitle>Umrah pool requests</CardTitle></CardHeader><CardContent className="divide-y">{requests.map(r => <Link key={r.id} href={`${agent ? "/agent" : "/account"}/umrah/requests/${r.id}`} className="flex flex-wrap justify-between gap-3 py-4 hover:text-primary"><div><strong>{r.quote_snapshot.packageName}</strong><div className="text-sm">{r.reference} · {r.num_pilgrims} pilgrims · {r.quote_snapshot.departureDate}</div></div><div><div>{POOL_REQUEST_LABELS[r.status]}</div><div className="text-right tabular-nums">{r.currency} {r.total.toFixed(2)}</div></div></Link>)}</CardContent></Card>;
}
