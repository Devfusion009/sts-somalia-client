import Link from "next/link";
import { getServerTrpc } from "@/lib/trpc/server";
import { POOL_REQUEST_LABELS } from "@sts/shared-types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PoolAdminOperation, PoolConfiguration } from "./pool-configuration";

export async function PoolAdminWorkspace({ packageId, draft }: { packageId: string; draft: boolean }) {
  const trpc = await getServerTrpc({timeoutMs:15000});
  const departures = await trpc.umrah.poolRequests.departures.query({ packageId });
  return <Card><CardHeader><CardTitle>Group formation & applicants</CardTitle></CardHeader><CardContent className="space-y-6">
    {await Promise.all(departures.map(async departure => {
      const requests = departure.booking_mode === "request_then_pay" ? await trpc.umrah.poolRequests.applicants.query({ departureId: departure.id }) : [];
      const delivery = departure.booking_mode === "request_then_pay" ? await trpc.umrah.poolRequests.delivery.query({departureId:departure.id}) : [];
      const paid = requests.filter(r => r.status === "paid").reduce((n,r) => n+r.num_pilgrims,0);
      return <section key={departure.id} className="space-y-4">
        <h3 className="font-semibold">{departure.departure_date} — {departure.return_date}</h3>
        {departure.booking_mode === "immediate_payment" ? draft ? <PoolConfiguration departureId={departure.id} /> : <span>Immediate payment</span> : <>
          <dl className="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-4">{[["Allocated",`${departure.booked_seats} / ${departure.total_seats}`],["Remaining",departure.total_seats-departure.booked_seats],["Paid places",paid],["Status",departure.formation_status.replaceAll("_"," ")]].map(([k,v])=><div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
          {departure.activation_error ? <div role="alert" className="text-destructive">{departure.activation_error}</div> : null}
          {departure.formation_status === "activation_pending" && departure.booked_seats === departure.total_seats ? <PoolAdminOperation operation="confirm" target={departure.id} label="Confirm group & invite payment" /> : null}
          {departure.formation_status === "payment_open" && departure.booked_seats < departure.total_seats ? <PoolAdminOperation operation="open_replacements" target={departure.id} label={departure.replacement_sales_open ? "Replacement sales open" : "Open replacement places"} /> : null}
          <Link href={`/admin/umrah/departures/${departure.id}`} className="text-primary underline">Departure operations & cancellation</Link>
          <div className="divide-y rounded-xl border">{requests.length === 0 ? <div className="p-4">No requests</div> : requests.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="space-y-1"><strong>{r.reference}</strong><div>{r.num_pilgrims} pilgrims · {r.agency_id ? "B2B" : "B2C"} · {POOL_REQUEST_LABELS[r.status]}</div></div><div>{r.currency} {r.total.toFixed(2)}</div>{r.payment_due_at ? <time dateTime={r.payment_due_at}>{new Date(r.payment_due_at).toLocaleString("en-GB",{timeZone:"Africa/Mogadishu"})} EAT</time> : null}{r.order_id ? <Link href={`/admin/orders/${r.order_id}`} className="text-primary underline">View order</Link> : null}</div>)}</div>
          <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Notification delivery · Latest 200</summary><ul className="divide-y">{delivery.map(job=><li key={job.id} className="flex flex-wrap justify-between gap-3 py-3"><div>{job.request.reference} · {job.kind.replaceAll("_"," ")} · {job.status} · {job.attempts} attempts{job.last_error?<div className="text-destructive">{job.last_error}</div>:null}</div>{job.status==='failed'||job.status==='pending'?<PoolAdminOperation operation="retry_email" target={job.id} label="Retry notification"/>:null}</li>)}</ul></details>
        </>}
      </section>;
    }))}
  </CardContent></Card>;
}
