"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { trpc } from "@/lib/trpc/react";

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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const recordPayment = trpc.payments.admin.recordPayment.useMutation();

  async function handleSubmit(formData: FormData) {
    setError(null);
    try {
      const result = await recordPayment.mutateAsync({
        orderId,
        amount: Number(formData.get("amount")),
        methodLabel: String(formData.get("methodLabel") ?? ""),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the payment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 gap-1" />}>
        <Wallet className="size-3.5" /> Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={handleSubmit}>
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
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
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
