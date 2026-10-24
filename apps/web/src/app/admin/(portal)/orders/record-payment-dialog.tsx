"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
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
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Wallet aria-hidden="true" /> Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="record-amount">Amount ({currency})</FieldLabel>
              <Input
                id="record-amount"
                name="amount"
                type="number"
                min={0.01}
                max={remaining}
                step="0.01"
                defaultValue={remaining.toFixed(2)}
                required
                className="tabular-nums"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="record-method">Payment method</FieldLabel>
              <Input id="record-method" name="methodLabel" placeholder="e.g. Cash — head office" required />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Recording…">Record</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
