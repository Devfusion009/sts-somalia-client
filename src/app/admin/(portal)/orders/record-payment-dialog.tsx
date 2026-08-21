"use client";

import { useActionState, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { adminRecordPayment, type RecordPaymentState } from "@/modules/payments/actions";

/** Logs a payment taken outside the online flow — cash at the office, a bank transfer that arrived without a prior "Pay at Office" attempt. */
export function RecordPaymentDialog({
  orderId,
  remaining,
  currency,
}: {
  orderId: string;
  remaining: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<RecordPaymentState, FormData>(adminRecordPayment, null);

  // Derived during render (not an effect) per React's guidance for reacting
  // to a state change — refs can't be read/written during render.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 gap-1" />}>
        <Wallet className="size-3.5" /> Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={formAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              For payments taken outside the online flow — cash at the office, a bank transfer
              that arrived without the customer starting a &ldquo;Pay at Office&rdquo; attempt first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="record-amount">Amount ({currency})</Label>
              <Input
                id="record-amount"
                name="amount"
                type="number"
                min={0.01}
                max={remaining}
                step="0.01"
                defaultValue={remaining.toFixed(2)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Remaining balance: {currency} {remaining.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-method">How did they pay?</Label>
              <Input id="record-method" name="methodLabel" placeholder="e.g. Cash — head office" required />
            </div>
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
