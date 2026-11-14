"use client";

import { useActionState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileField } from "@/components/ui/upload";
import { SubmitButton } from "@/components/submit-button";
import { uploadPaymentProof, type PaymentProof, type ProofState } from "../proof-actions";

export function BankTransferProof({ paymentId, proofs }: { paymentId: string; proofs: PaymentProof[] }) {
  const latest = proofs[0];
  const [state, action] = useActionState(async (prev: ProofState, data: FormData): Promise<ProofState> => {
    try {
      const result = await uploadPaymentProof(prev, data);
      if (result && !result.error) window.location.reload();
      return result;
    } catch { return { error: "Upload failed. Please try again." }; }
  }, null);
  return (
    <div className="mt-6 space-y-4 border-t border-border pt-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-primary" /> Transfer proof</div>
      {latest ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <a className="font-medium underline underline-offset-4" href={`/api/payments/proofs/${latest.id}`} target="_blank" rel="noopener noreferrer">{latest.file_name}</a>
          <p className={latest.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>
            {latest.status === "rejected" ? `Correction requested: ${latest.rejection_reason}` : "Proof submitted · Awaiting staff verification"}
          </p>
          {latest.transfer_reference ? <p className="text-muted-foreground">Reference: {latest.transfer_reference}</p> : null}
        </div>
      ) : null}
      {(!latest || latest.status === "rejected") ? (
        <form action={action} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <div className="space-y-2"><Label htmlFor="transfer-reference">Bank transfer reference (optional)</Label><Input id="transfer-reference" name="reference" maxLength={200} /></div>
          <FileField name="file" accept=".jpg,.jpeg,.png,.pdf" required maxBytes={5 * 1024 * 1024} label="Transfer receipt or bank statement" />
          {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          <SubmitButton pendingText="Uploading…" className="min-h-11 gap-2 rounded-lg"><Upload className="size-4" />{latest ? "Submit corrected proof" : "Submit transfer proof"}</SubmitButton>
        </form>
      ) : null}
      {proofs.length > 1 ? <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Earlier proofs ({proofs.length - 1})</summary><ul className="mt-2 space-y-2">{proofs.slice(1).map(p => <li key={p.id}><a href={`/api/payments/proofs/${p.id}`} target="_blank" rel="noopener noreferrer" className="underline">{p.file_name}</a> · {p.status}</li>)}</ul></details> : null}
    </div>
  );
}
