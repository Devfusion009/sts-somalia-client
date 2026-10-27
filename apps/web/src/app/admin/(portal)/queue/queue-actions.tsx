"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import { updateHotelBookingStatus, updateHallBookingStatus } from "@/modules/admin/actions";
import {
  updateUmrahBookingStatus,
  updateUmrahRequestPrice,
} from "@/modules/umrah/service-admin-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";
import { money } from "@/lib/money";

/**
 * Wraps a server action so success raises a toast from the call itself — the
 * queue row unmounts as soon as the decision lands, so an effect on the
 * returned state would never get to run.
 */
function withToast(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  message: (formData: FormData) => string
) {
  return async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else toast.success(message(formData), { position: "top-center" });
    return result;
  };
}

export type QueueKind = "hotel" | "hall" | "umrah";

const STATUS_ACTIONS = {
  hotel: updateHotelBookingStatus,
  hall: updateHallBookingStatus,
  umrah: updateUmrahBookingStatus,
} as const;


/**
 * Confirm / Decline for one queue entry. Confirming a waitlisted hotel
 * booking is a promotion — the DB re-checks availability at that instant and
 * the error ("still not enough rooms available on <date>") surfaces inline,
 * so a stale waitlist entry can't silently double-book.
 */
export function QueueEntryActions({ kind, bookingId }: { kind: QueueKind; bookingId: string }) {
  const action = STATUS_ACTIONS[kind];
  const [confirmState, confirmAction] = useActionState(
    withToast(action, () => "Booking confirmed."),
    null
  );
  const [declineState, declineAction] = useActionState(
    withToast(action, () => "Request declined."),
    null
  );
  const error = confirmState?.error ?? declineState?.error;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
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
            title="Decline this request?"
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
        <p role="alert" className="max-w-64 text-xs text-destructive sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A private Umrah trip has no list price: staff set it here, and it updates
 * the booking and the customer's unpaid order together.
 */
export function PriceQuoteForm({
  bookingId,
  currentPrice,
  currency,
}: {
  kind: "umrah";
  bookingId: string;
  currentPrice: number;
  currency: string;
}) {
  const action = updateUmrahRequestPrice;
  const [state, formAction] = useActionState(
    withToast(action, (fd) => `Price set to ${money(Number(fd.get("price")), currency)}.`),
    null
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1 sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-2">
        <InputGroup className="w-36 max-sm:h-10">
          <InputGroupAddon>
            <InputGroupText>{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={currentPrice > 0 ? currentPrice.toFixed(2) : ""}
            placeholder="Final price"
            aria-label={`Final price (${currency})`}
            aria-invalid={state?.error ? true : undefined}
            className="text-right tabular-nums"
          />
        </InputGroup>
        <SubmitButton variant="outline" pendingText="Saving…">
          Quote
        </SubmitButton>
      </div>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
