"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { money } from "@/lib/money";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";

// Same `money()` format as every other figure on the order page (Net,
// Margin, Customer pays, Balance) — two formats for one amount a few pixels
// apart read as two different numbers.

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
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const remaining = available - amount;

  // Settling lands back on this same page, so refresh rather than navigate.
  const initiate = trpc.payments.initiate.useMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      const data = await initiate.mutateAsync({ orderId, methodId: "agency_wallet" });
      if (data.error) {
        setError(data.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="w-full tabular-nums" />}>
        Pay {money(amount, currency)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Agency balance now</dt>
            <dd className="tabular-nums">{money(available, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="tabular-nums">− {money(amount, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="font-medium">Balance after</dt>
            <dd className="font-heading text-base font-semibold tabular-nums text-primary">
              {money(remaining, currency)}
            </dd>
          </div>
        </dl>

        <form action={handleSubmit} className="space-y-4">
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Paying…">Confirm payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
