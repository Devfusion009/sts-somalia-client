"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { money } from "@/lib/money";
import { payBatchFromWallet } from "@/modules/agencies/batch-booking-actions";

/**
 * Same confirm step as the single-order page: the wallet is charged for every
 * order in the batch at once, so the exact before/after balance is shown first.
 */
export function PayBatchForm({
  batchId,
  count,
  amount,
  available,
  currency,
}: {
  batchId: string;
  count: number;
  amount: number;
  available: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(payBatchFromWallet, null);
  const submitted = useRef(false);
  const router = useRouter();
  const label = `${count} order${count === 1 ? "" : "s"}`;

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      submitted.current = false;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="w-full tabular-nums" />}>
        Pay {label} · {money(amount, currency)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Available to spend</dt>
            <dd className="tabular-nums">{money(available, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">− {money(amount, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="font-medium">Available after</dt>
            <dd className="font-heading text-base font-semibold tabular-nums text-primary">
              {money(available - amount, currency)}
            </dd>
          </div>
        </dl>

        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="batchId" value={batchId} />
          <FieldError>{state?.error}</FieldError>
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
