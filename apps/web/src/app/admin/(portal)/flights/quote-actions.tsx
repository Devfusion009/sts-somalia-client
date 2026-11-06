"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  declineFlightQuote,
  markFlightTicketed,
  sendFlightQuote,
  type FlightQuoteState,
} from "@/modules/flights/admin-quote-actions";

function useResultToast(state: FlightQuoteState) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) toast.success(state.ok);
  }, [state]);
}

export function FlightQuoteForm({
  bookingId,
  currency,
  price,
  airline,
  quoted,
}: {
  bookingId: string;
  currency: string;
  price: number | null;
  airline: string | null;
  quoted: boolean;
}) {
  const [quoteState, quoteAction] = useActionState(sendFlightQuote, null);
  const [declineState, declineAction] = useActionState(declineFlightQuote, null);
  useResultToast(quoteState);
  useResultToast(declineState);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <form action={quoteAction} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="currency" value={currency} />
        <Input
          name="airline"
          defaultValue={airline ?? ""}
          maxLength={120}
          placeholder="Airline and flight numbers"
          aria-label="Airline"
          className="w-64 max-sm:h-10"
        />
        <InputGroup className="w-40 max-sm:h-10">
          <InputGroupAddon>
            <InputGroupText>{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            name="price"
            type="number"
            min={0.01}
            step="0.01"
            required
            defaultValue={price ?? undefined}
            placeholder="Total fare"
            className="text-right tabular-nums"
            aria-label={`Total fare (${currency})`}
          />
        </InputGroup>
        <SubmitButton pendingText="Sending…">{quoted ? "Update quote" : "Send quote"}</SubmitButton>
      </form>
      <form action={declineAction}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <ConfirmButton
          title="Decline this flight request?"
          confirmLabel="Decline"
          icon="x"
          variant="outline"
          className="text-destructive hover:text-destructive"
        >
          Decline
        </ConfirmButton>
      </form>
    </div>
  );
}

export function FlightTicketForm({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useActionState(markFlightTicketed, null);
  useResultToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Input
        name="pnr"
        required
        minLength={5}
        maxLength={8}
        placeholder="PNR"
        aria-label="Airline booking reference (PNR)"
        className="w-32 font-mono uppercase max-sm:h-10"
      />
      <SubmitButton pendingText="Saving…">Mark ticketed</SubmitButton>
    </form>
  );
}
