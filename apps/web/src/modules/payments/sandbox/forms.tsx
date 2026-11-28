"use client";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FlaskConical, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSandboxCheckout, saveSandboxCredentials, checkSandboxCheckout } from "./actions";
import { SANDBOX_PATH, SANDBOX_WALLETS, type SandboxState } from "./shared";

export function SandboxCredentials({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(saveSandboxCredentials, { error: null });
  return <details className="rounded-2xl border border-border bg-card p-5" open={!configured}>
    <summary className="cursor-pointer text-sm font-semibold">Sandbox credentials <span className="ml-2 text-xs font-normal text-muted-foreground">{configured ? "Saved and verified" : "Not configured"}</span></summary>
    <form action={action} autoComplete="off" className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">{[
        ["merchant_uid", "Merchant UID"], ["api_user_id", "API user ID"], ["api_key", "API key"], ["store_id", "Store ID"], ["hpp_key", "HPP key"],
      ].map(([name, label]) => <div key={name} className="space-y-2"><Label htmlFor={`sandbox-${name}`}>{label}</Label>
        {name.endsWith("key") ? <PasswordInput id={`sandbox-${name}`} name={name} required autoComplete="new-password" maxLength={200} data-1p-ignore data-lpignore="true" /> : <Input id={`sandbox-${name}`} name={name} required autoComplete="off" maxLength={50} />}
      </div>)}</div>
      <ResultMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Verifying sandbox…" : "Save and test sandbox"}<ShieldCheck className="size-4" aria-hidden="true" /></Button>
    </form>
  </details>;
}
function ResultMessage({ state }: { state: SandboxState }) {
  return state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : state.success ? <p role="status" className="text-sm text-primary">{state.success}</p> : null;
}
export function SandboxCheckout({ reference, configured }: { reference: string; configured: boolean }) {
  const [state, action, pending] = useActionState(createSandboxCheckout, { error: null });
  return <section className="rounded-2xl border border-border bg-card p-6">
    <div className="mb-6 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><FlaskConical className="size-5" aria-hidden="true" /></span><h2 className="font-heading text-lg font-semibold">Create a sandbox payment</h2></div>
    <form action={action} className="space-y-5">
      <input name="reference" type="hidden" value={reference} />
      <div className="space-y-2"><Label htmlFor="sandbox-amount">Test amount (USD)</Label><Input id="sandbox-amount" name="amount" defaultValue="1.00" type="number" inputMode="decimal" min="0.01" max="100" step="0.01" required disabled={pending || !!state.reference} /></div>
      <div className="space-y-2"><Label htmlFor="sandbox-phone">Test wallet</Label><select id="sandbox-phone" name="phone" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={pending || !!state.reference}>{SANDBOX_WALLETS.map(wallet => <option key={wallet.phone} value={wallet.phone}>{wallet.label}</option>)}</select></div>
      <div className="flex items-center justify-between rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>WaafiPay test PIN</span><code className="font-semibold tracking-widest">1212</code></div>
      <ResultMessage state={state} />
      {!state.reference && <Button type="submit" disabled={pending || !configured} className="w-full">{pending ? "Creating test checkout…" : "Create sandbox checkout"}<ArrowRight className="size-4" aria-hidden="true" /></Button>}
    </form>
    {state.reference && <div className="mt-5"><SandboxResult initial={state} /></div>}
  </section>;
}
export function SandboxResult({ initial }: { initial: SandboxState }) {
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const approved = state.status === "approved";
  const declined = state.status === "declined" || state.status === "failed";
  const unavailable = !!state.error && !state.reference;
  const Icon = approved ? CheckCircle2 : declined || unavailable ? XCircle : Clock3;
  return <section className="space-y-4" aria-label="Sandbox test result">
    <div role="status" className={`rounded-xl border p-4 ${approved ? "border-emerald-200 bg-emerald-50 text-emerald-900" : declined ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div className="flex items-center gap-2 font-semibold"><Icon className="size-5" aria-hidden="true" />{unavailable ? "Sandbox result unavailable" : approved ? "Sandbox test approved" : declined ? "Sandbox test not approved" : "Sandbox test awaiting confirmation"}</div>
      {state.amountMinor !== undefined && <div className="mt-3 text-2xl font-semibold tabular-nums">USD {(state.amountMinor / 100).toFixed(2)} <span className="text-xs font-medium uppercase tracking-wider">Test only</span></div>}
      {state.reference && <dl className="mt-3 space-y-1 text-xs"><dt>Test reference</dt><dd className="break-all font-mono">{state.reference}</dd>{state.transactionId && <><dt className="pt-2">Sandbox transaction</dt><dd className="break-all font-mono">{state.transactionId}</dd></>}</dl>}
    </div>
    <ResultMessage state={state} />
    {state.checkoutUrl && !approved && !declined && <Button className="w-full" render={<a href={state.checkoutUrl} />}>Open WaafiPay sandbox<ArrowRight className="size-4" aria-hidden="true" /></Button>}
    <div className="flex flex-wrap gap-2">
      {state.reference && !approved && !declined && <Button variant="outline" disabled={pending} onClick={() => start(async () => {
        try { setState(await checkSandboxCheckout(state.reference!)); } catch { setState({ ...state, error: "Sandbox status is unavailable." }); }
      })}><RefreshCw className="size-4" aria-hidden="true" />{pending ? "Checking sandbox…" : "Check sandbox result"}</Button>}
      <Button variant="outline" render={<Link href={SANDBOX_PATH} onClick={event => { event.preventDefault(); window.location.assign(SANDBOX_PATH); }} />}>New sandbox test</Button>
    </div>
  </section>;
}
