"use client";

import { useActionState } from "react";
import { Check, X, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  updateHotelBookingStatus,
  updateHallBookingStatus,
  updateHotelBookingPrice,
  updateHallBookingPrice,
} from "@/modules/admin/actions";
import {
  updateUmrahBookingStatus,
  updateUmrahRequestPrice,
} from "@/modules/umrah/service-admin-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";

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

const PRICE_ACTIONS = {
  hotel: updateHotelBookingPrice,
  hall: updateHallBookingPrice,
  umrah: updateUmrahRequestPrice,
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
            title="Decline this request?"
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
 * Manual requests carry an ESTIMATE (per-person halls) or no price at all
 * (price-on-request rooms). This is where staff set the real quote — it
 * updates the booking AND the customer's unpaid order, so what they pay
 * after confirmation is exactly what was quoted here.
 */
export function PriceQuoteForm({
  kind,
  bookingId,
  currentPrice,
  currency,
}: {
  kind: QueueKind;
  bookingId: string;
  currentPrice: number;
  currency: string;
}) {
  const action = PRICE_ACTIONS[kind];
  const [state, formAction] = useActionState(
    withToast(action, (fd) => `Price set to ${currency} ${Number(fd.get("price")).toFixed(2)}.`),
    null
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{currency}</span>
        <Input
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={currentPrice > 0 ? currentPrice.toFixed(2) : ""}
          placeholder="Final price"
          className="h-8 w-28 text-right"
        />
        <SubmitButton size="sm" variant="outline" pendingText="Saving…" className="gap-1">
          <DollarSign className="size-3.5" /> Quote
        </SubmitButton>
      </div>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
