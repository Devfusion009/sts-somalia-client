"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { money } from "@/lib/money";
import { transferAgencyEarnings } from "@/modules/agencies/earnings-transfer-actions";

export function TransferEarningsForm({ amount, transferId, disabled }: { amount: number; transferId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(async (previous: { error: string | null; message?: string }, formData: FormData) => {
    const next = await transferAgencyEarnings(previous, formData);
    if (!next.error) {
      setOpen(false);
      toast.success(next.message);
      router.refresh();
    }
    return next;
  }, { error: null });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={disabled} />}>
        Transfer earnings to wallet
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Transfer earnings to wallet</DialogTitle></DialogHeader>
        <dl className="flex items-center justify-between text-sm">
          <dt>Approved earnings</dt><dd className="font-semibold tabular-nums">{money(amount, "USD")}</dd>
        </dl>
        <form action={action} className="space-y-4">
          <input type="hidden" name="amount" value={amount} />
          <input type="hidden" name="transferId" value={transferId} />
          <FieldError>{state.error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Transferring…">Confirm transfer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
