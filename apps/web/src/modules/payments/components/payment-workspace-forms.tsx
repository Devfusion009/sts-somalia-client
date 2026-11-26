"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { money } from "@/lib/money";
import { importStsSandbox, recordTransfer, saveAgencyGateway, testAgencyGateway, type WorkspaceResult } from "../workspace-actions";
import type { PaymentScope } from "../workspace-store";
import { collectAgencyPayment, refreshAgencyCollection } from "../agency-collections";

const inputClass = "mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50";
export function AgencyCollectionForm({ requestId, gateways }: {requestId:string;gateways:{id:string;environment:string}[]}) {
  const [state,action,pending]=useActionState(collectAgencyPayment,{error:null});
  return <form action={action} className="space-y-5"><input type="hidden" name="id" value={requestId}/><div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Gateway<select required name="gateway" className={inputClass}>{gateways.map(g=><option key={g.id} value={g.id}>WaafiPay · {g.environment}</option>)}</select></label>
    <label className="text-sm font-medium">Amount (USD)<input required name="amount" inputMode="decimal" className={inputClass}/></label>
    <label className="text-sm font-medium">Customer name<input required name="counterparty" maxLength={160} className={inputClass}/></label>
    <label className="text-sm font-medium">Mobile number<input required name="phone" type="tel" placeholder="252…" className={inputClass}/></label>
  </div><Result state={state}/>{state.url && <a className={buttonClass} href={state.url}>Open secure checkout</a>}<button disabled={pending || !gateways.length || !!state.success} className={buttonClass}>{pending?"Requesting…":"Request payment"}</button>{state.success && <button type="button" className="ml-3 min-h-11 rounded-xl border border-border px-5 text-sm font-semibold" onClick={() => window.location.reload()}>New payment</button>}</form>;
}
export function CollectionRefresh({ id }: {id:string}) {
  const [pending,start]=useTransition();
  const [state,setState]=useState<WorkspaceResult>({error:null});
  return <div><button disabled={pending} className="min-h-10 rounded-xl border border-border px-3 text-sm" onClick={()=>start(async()=>{
    try{setState(await refreshAgencyCollection(id));}catch{setState({error:"Payment status unavailable."});}
  })}>{pending?"Checking…":"Check payment"}</button><Result state={state}/></div>;
}
export function ImportSandboxButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<WorkspaceResult>({ error: null });
  return <div className="space-y-3"><button className={buttonClass} disabled={pending} onClick={() => start(async () => {
    try { setState(await importStsSandbox()); } catch { setState({ error: "Sandbox setup is unavailable." }); }
  })}>{pending ? "Verifying…" : "Import and verify STS sandbox"}</button><Result state={state} /></div>;
}
function Result({ state }: { state: WorkspaceResult }) {
  if (!state.error && state.confirmation) return <div role="status" className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5 text-foreground">
    <CheckCircle2 size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-3"><span className="font-semibold">Payment received</span><span className="ml-auto text-right text-2xl font-bold tabular-nums text-primary">{money(state.confirmation.amountMinor / 100, "USD")}</span></div>
      <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm"><dt className="text-muted-foreground">Reference ID</dt><dd className="break-all font-mono">{state.confirmation.reference}</dd></dl>
    </div>
  </div>;
  return state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : state.success ? <p role="status" className="text-sm text-primary">{state.success}</p> : null;
}

export function TransferForm({ scope, requestId, receipts }: { scope: PaymentScope; requestId: string; receipts: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(recordTransfer.bind(null, scope), { error: null });
  const [kind, setKind] = useState("transfer");
  return <form action={action} className="space-y-5">
    <input type="hidden" name="id" value={requestId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Entry type<select name="kind" className={inputClass} value={kind} onChange={e => setKind(e.target.value)}><option value="transfer">Transfer</option><option value="refund">Refund</option></select></label>
      <label className="text-sm font-medium">Direction<select name="direction" className={inputClass} key={kind} defaultValue={kind === "refund" ? "out" : "in"}>{kind !== "refund" && <option value="in">Payment in</option>}<option value="out">Payment out</option></select></label>
      <label className="text-sm font-medium">Amount (USD)<input required name="amount" inputMode="decimal" placeholder="0.00" className={inputClass} /></label>
      <label className="text-sm font-medium">Method<select name="method" className={inputClass}><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option></select></label>
      <label className="text-sm font-medium">Counterparty<input required name="counterparty" maxLength={160} className={inputClass} /></label>
      <label className="text-sm font-medium">Transfer reference<input required name="reference" maxLength={120} className={inputClass} /></label>
    </div>
    {kind === "refund" ? <label className="block text-sm font-medium">Original receipt<select required name="original" className={inputClass}><option value="">Select receipt</option>{receipts.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label> : <input type="hidden" name="original" value="" />}
    <Result state={state} />
    <button className={buttonClass} disabled={pending || !!state.success}>{pending ? "Recording…" : "Record completed transfer"}</button>
  </form>;
}

export function AgencyGatewayForm() {
  const [state, action, pending] = useActionState(saveAgencyGateway, { error: null });
  return <form action={action} className="space-y-5">
    <label className="block text-sm font-medium">Environment<select name="environment" className={inputClass}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label>
    <div className="grid gap-4 sm:grid-cols-2">
      {[["merchant_uid", "Merchant UID"], ["api_user_id", "API user ID"], ["api_key", "API key"], ["store_id", "Store ID"], ["hpp_key", "HPP key"]].map(([name, label]) => <label key={name} className="text-sm font-medium">{label}<input required name={name} type={name.endsWith("key") ? "password" : "text"} autoComplete="off" maxLength={200} className={inputClass} /></label>)}
    </div>
    <Result state={state} />
    <button className={buttonClass} disabled={pending}>{pending ? "Saving…" : "Save WaafiPay credentials"}</button>
  </form>;
}

export function GatewayTestButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<WorkspaceResult>({ error: null });
  return <div className="space-y-2"><button disabled={pending} className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50" onClick={() => start(async () => {
    try { setState(await testAgencyGateway(id)); } catch { setState({ error: "Connection test is unavailable." }); }
  })}>{pending ? "Testing…" : "Test connection"}</button><Result state={state} /></div>;
}
