"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
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
          <SubmitButton pendingText="Confirming…">
            <Check aria-hidden="true" /> Confirm
          </SubmitButton>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="cancelled" />
          <ConfirmButton
            title="Decline this Umrah request?"
            confirmLabel="Decline"
            icon="x"
            variant="outline"
            className="text-destructive hover:text-destructive"
          >
            <X aria-hidden="true" /> Decline
          </ConfirmButton>
        </form>
      </div>
      {error ? (
        <p role="alert" className="max-w-64 text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
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
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <InputGroup className="w-40 max-sm:h-10">
        <InputGroupAddon>
          <InputGroupText>{currency}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={currentPrice}
          className="text-right tabular-nums"
          aria-label={`Confirmed price (${currency})`}
          aria-invalid={state?.error ? true : undefined}
        />
      </InputGroup>
      <SubmitButton variant="outline" pendingText="Saving…">
        Update price
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="w-full text-right text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state && !state.error ? (
        <p role="status" className="w-full text-right text-xs text-primary">
          Price updated.
        </p>
      ) : null}
    </form>
  );
}
