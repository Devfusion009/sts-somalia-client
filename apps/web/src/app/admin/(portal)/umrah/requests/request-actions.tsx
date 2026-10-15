"use client";

import { useActionState } from "react";
import { Check, DollarSign, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  updateUmrahBookingStatus,
  updateUmrahRequestPrice,
} from "@/modules/umrah/service-admin-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

/**
 * Confirm / Decline for one private Umrah request. Confirming means STS has
 * held the hotels, seats and visa slots — it is what unlocks the customer's
 * "Complete payment" button on their booking page.
 */
export function UmrahRequestActions({ bookingId }: { bookingId: string }) {
  const [confirmState, confirmAction] = useActionState(updateUmrahBookingStatus, null);
  const [declineState, declineAction] = useActionState(updateUmrahBookingStatus, null);
  const error = confirmState?.error ?? declineState?.error;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="confirmed" />
          <SubmitButton size="sm" pendingText="Confirming…" className="gap-1">
            <Check className="size-3.5" /> Confirm
          </SubmitButton>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="cancelled" />
          <ConfirmButton
            title="Decline this Umrah request?"
            confirmLabel="Decline"
            icon="x"
            size="sm"
            variant="outline"
            className="gap-1 text-destructive hover:text-destructive"
          >
            <X className="size-3.5" /> Decline
          </ConfirmButton>
        </form>
      </div>
      {error ? <p className="max-w-64 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Adjust the quoted total before the customer pays. The builder's arithmetic
 * is exact, but a real trip can move — a hotel comes back full at that rate,
 * a fare changes — and this is where that lands, keeping the unpaid order in
 * step so the customer is charged what was confirmed.
 */
export function UmrahPriceQuoteForm({
  bookingId,
  currentPrice,
  currency,
}: {
  bookingId: string;
  currentPrice: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(updateUmrahRequestPrice, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <DollarSign className="size-3.5" /> {currency}
      </span>
      <Input
        name="price"
        type="number"
        min={0}
        step="0.01"
        defaultValue={currentPrice}
        className="h-8 w-32"
        aria-label="Confirmed price"
      />
      <SubmitButton size="sm" variant="outline" pendingText="Saving…">
        Update price
      </SubmitButton>
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state && !state.error ? <span className="text-xs text-primary">Saved</span> : null}
    </form>
  );
}
