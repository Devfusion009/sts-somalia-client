import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc, TRPCClientError } from "@/lib/trpc/server";
import { POOL_REQUEST_LABELS } from "@sts/shared-types";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WithdrawPoolRequest } from "./withdraw-pool-request";
export async function PoolRequestDetail({ id, agent = false }: { id: string; agent?: boolean }) {
  await requireUser();
  let r;
  try {
    r=await (await getServerTrpc({timeoutMs:15000})).umrah.poolRequests.get.query({requestId:id});
  } catch (error) {
    if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (agent !== !!r.agency_id) notFound();
  const due=r.canPay;
  return <div className="space-y-6"><PageHeader title={r.quote_snapshot.packageName} back={{href:agent?'/agent/bookings':'/account/bookings',label:'Bookings'}} />
    <Card><CardHeader><CardTitle>{r.reference}</CardTitle></CardHeader><CardContent className="space-y-5"><Badge variant={r.status==='paid'?'success':'info'}>{r.paymentReview ? "Payment under review" : r.paymentProcessing ? "Payment processing" : POOL_REQUEST_LABELS[r.status]}</Badge><dl className="grid gap-5 sm:grid-cols-3">{[['Travel dates',`${r.quote_snapshot.departureDate} — ${r.quote_snapshot.returnDate}`],['Pilgrims',r.num_pilgrims],['Quoted total',`${r.currency} ${r.total.toFixed(2)}`]].map(([k,v])=><div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
    {r.payment_due_at && r.status==='payment_due' ? <div>Payment deadline: <time dateTime={r.payment_due_at}>{new Date(r.payment_due_at).toLocaleString('en-GB',{timeZone:'Africa/Mogadishu'})} EAT</time></div>:null}
    <div className="flex flex-wrap gap-3">{r.status==='requested'?<WithdrawPoolRequest id={r.id}/>:null}{r.order_id?<Button render={<Link href={agent?`/agent/bookings/${r.order_id}`:due?`/checkout/${r.order_id}`:`/account/bookings/${r.order_id}`}/>}>{due?(r.paymentInstructions?'Continue payment':'Pay now'):'View booking'}</Button>:null}</div>
    {r.closed_reason?<div>{r.closed_reason}</div>:null}</CardContent></Card>
    <Card><CardHeader><CardTitle>Travelers</CardTitle></CardHeader><CardContent><ul className="divide-y">{r.travelers.map(t=><li key={t.id} className="py-3">{t.full_name}</li>)}</ul></CardContent></Card>
    <Card><CardHeader><CardTitle>Accepted terms</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap">{r.quote_snapshot.terms}</CardContent></Card>
  </div>;
}
