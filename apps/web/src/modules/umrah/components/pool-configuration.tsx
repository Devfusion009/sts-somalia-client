"use client";
import { useActionState } from "react";
import { poolAdminOperation, configureRequestPool } from "../pool-request-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export function PoolConfiguration({ departureId }: { departureId: string }) {
  const [state, action] = useActionState(configureRequestPool, null);
  return <form action={action} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
    <input type="hidden" name="departureId" value={departureId} />
    <div className="space-y-2"><Label htmlFor={`formation-${departureId}`}>Formation closes (Mogadishu)</Label><Input id={`formation-${departureId}`} name="formationClosesAt" type="datetime-local" required /></div>
    <div className="space-y-2"><Label htmlFor={`cutoff-${departureId}`}>Final payment cutoff (Mogadishu)</Label><Input id={`cutoff-${departureId}`} name="paymentCutoffAt" type="datetime-local" required /></div>
    <div className="space-y-2"><Label htmlFor={`window-${departureId}`}>Payment window (hours)</Label><Input id={`window-${departureId}`} name="paymentWindowHours" type="number" min={1} max={168} defaultValue={48} required /></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor={`terms-${departureId}`}>Formation and cancellation terms</Label><Textarea id={`terms-${departureId}`} name="terms" minLength={10} maxLength={5000} required /></div>
    {state?.error ? <div role="alert" className="text-destructive sm:col-span-2">{state.error}</div> : state ? <div role="status">Pool configuration saved.</div> : null}
    <SubmitButton>Use request-first booking</SubmitButton>
  </form>;
}

export function PoolAdminOperation({operation,target,label}:{operation:"retry_email"|"open_replacements"|"confirm";target:string;label:string}) {
  const [state,action]=useActionState(poolAdminOperation,null);
  return <form action={action} className="space-y-2"><input type="hidden" name="operation" value={operation}/><input type="hidden" name="target" value={target}/><SubmitButton variant="outline" size="sm">{label}</SubmitButton>{state?.error?<div role="alert" className="text-destructive">{state.error}</div>:state?<div role="status">{operation === "confirm" ? "Payment invitations queued." : "Updated."}</div>:null}</form>;
}
