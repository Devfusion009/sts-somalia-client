"use client";

import { useActionState, useState } from "react";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { reviewBankPayment, type PaymentProof, type ProofState } from "@/modules/payments/proof-actions";

export function BankPaymentReview({ paymentId, proofs, amount, orderNumber }: { paymentId: string; proofs: PaymentProof[]; amount: string; orderNumber: string }) {
  const latest = proofs[0];
  const [viewed, setViewed] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [state, action] = useActionState(async (prev: ProofState, data: FormData): Promise<ProofState> => {
    try {
      const result = await reviewBankPayment(prev, data);
      if (result && !result.error) window.location.reload();
      return result;
    } catch { return { error: "Payment could not be updated. Refresh before retrying." }; }
  }, null);
  if (!latest) return <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">Awaiting customer proof</span>;
  if (latest.status === "rejected") return <span className="text-xs text-amber-800" title={latest.rejection_reason ?? undefined}>Correction requested · <a className="underline" href={`/api/payments/proofs/${latest.id}`} target="_blank" rel="noopener noreferrer">View proof</a></span>;
  return (
    <Dialog onOpenChange={() => { setViewed(false); setDecision("approve"); }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}><FileSearch className="size-4" /> Review transfer proof</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Review bank transfer</DialogTitle></DialogHeader>
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <div><dt className="text-muted-foreground">Order</dt><dd className="mt-1 font-medium">{orderNumber}</dd></div>
          <div><dt className="text-muted-foreground">Amount to verify</dt><dd className="mt-1 font-semibold tabular-nums">{amount}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Bank reference</dt><dd className="mt-1 font-medium">{latest.transfer_reference || "Not provided"}</dd></div>
        </dl>
        <a className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary underline underline-offset-4" href={`/api/payments/proofs/${latest.id}`} target="_blank" rel="noopener noreferrer" onClick={() => setViewed(true)}><FileSearch className="size-4" />Open {latest.file_name}</a>
        <form action={action} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} /><input type="hidden" name="proofId" value={latest.id} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Review decision</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="radio" name="decision" value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} className="accent-primary" />Funds received</Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="radio" name="decision" value="reject" checked={decision === "reject"} onChange={() => setDecision("reject")} className="accent-primary" />Proof needs correction</Label>
            </div>
          </fieldset>
          {decision === "approve" ? (
            <Label className="flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" name="verified" required className="mt-0.5 accent-primary" />I confirmed that {amount} reached the STS bank account.</Label>
          ) : (
            <div className="space-y-2"><Label htmlFor={`reason-${paymentId}`}>Correction reason <span aria-hidden="true" className="text-destructive">*</span></Label><Textarea id={`reason-${paymentId}`} name="reason" rows={3} required minLength={5} maxLength={1000} placeholder="Enter what the customer needs to correct" /></div>
          )}
          {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          <div className="flex justify-end">
            <SubmitButton disabled={decision === "approve" && !viewed} pendingText="Saving…">{decision === "approve" ? "Confirm payment received" : "Request corrected proof"}</SubmitButton>
          </div>
        </form>
        {proofs.length > 1 ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Earlier proofs ({proofs.length - 1})</summary>{proofs.slice(1).map(p => <a className="mt-2 block underline" key={p.id} href={`/api/payments/proofs/${p.id}`} target="_blank" rel="noopener noreferrer">{p.file_name} · {p.status}</a>)}</details> : null}
      </DialogContent>
    </Dialog>
  );
}
