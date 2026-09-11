"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { initiatePayment } from "@/modules/payments/actions";

// Whole dollars, matching every other figure on this order page (Net,
// Margin, Customer pays, Balance) — showing cents only here made the same
// amount read as two different numbers a few pixels apart.
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Paying from the shared agency wallet moves real money immediately and
 * can't be undone from here — so it's a confirm step with the exact
 * before/after balance in view, not a single click that fires on contact.
 */
export function PayFromWalletForm({
  orderId,
  amount,
  available,
  currency,
}: {
  orderId: string;
  /** What this payment settles. */
  amount: number;
  /** Agency wallet balance before this payment. */
  available: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(initiatePayment, null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const remaining = available - amount;
  const settled = useRef(false);

  // Settling lands back on this same page, so refresh rather than navigate.
  useEffect(() => {
    if (state?.destination && !settled.current) {
      settled.current = true;
      onSettled();
    }

    function onSettled() {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex justify-end">
        <DialogTrigger render={<Button size="sm" />}>
          Pay {money(amount, currency)} from agency balance
        </DialogTrigger>
      </div>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
        </DialogHeader>

        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-heading text-lg font-bold tabular-nums">{money(amount, currency)}</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-muted-foreground">Agency balance now</dt>
            <dd className="tabular-nums">{money(available, currency)}</dd>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 px-3 py-2.5">
            <dt className="font-medium">Balance after</dt>
            <dd className="font-heading text-lg font-bold tabular-nums text-primary">
              {money(remaining, currency)}
            </dd>
          </div>
        </dl>

        {state?.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={formAction} className="flex justify-end gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="methodId" value="agency_wallet" />
          <input type="hidden" name="desk" value="1" />
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton size="sm" pendingText="Paying…">
            Confirm payment
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
