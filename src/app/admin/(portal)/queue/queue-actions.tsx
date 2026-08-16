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

/**
 * Confirm / Decline for one queue entry. Confirming a waitlisted hotel
 * booking is a promotion — the DB re-checks availability at that instant and
 * the error ("still not enough rooms available on <date>") surfaces inline,
 * so a stale waitlist entry can't silently double-book.
 */
export function QueueEntryActions({ kind, bookingId }: { kind: "hotel" | "hall"; bookingId: string }) {
  const action = kind === "hotel" ? updateHotelBookingStatus : updateHallBookingStatus;
  const [confirmState, confirmAction] = useActionState(action, null);
  const [declineState, declineAction] = useActionState(action, null);
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
          <SubmitButton size="sm" variant="outline" pendingText="Declining…" className="gap-1 text-destructive hover:text-destructive">
            <X className="size-3.5" /> Decline
          </SubmitButton>
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
  kind: "hotel" | "hall";
  bookingId: string;
  currentPrice: number;
  currency: string;
}) {
  const action = kind === "hotel" ? updateHotelBookingPrice : updateHallBookingPrice;
  const [state, formAction] = useActionState(action, null);

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
