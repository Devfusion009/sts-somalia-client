"use client";

import { useActionState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import { updateHotelBookingPrice } from "@/modules/admin/actions";

export function HotelBookingPriceForm({ bookingId, price, currency }: { bookingId: string; price: number; currency: string }) {
  const [state, formAction] = useActionState(updateHotelBookingPrice, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-1.5">
        <InputGroup className="h-7 w-32">
          <InputGroupAddon>
            <InputGroupText className="text-xs">{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={price}
            aria-label={`Price (${currency})`}
            aria-invalid={state?.error ? true : undefined}
            className="text-right text-sm tabular-nums"
          />
        </InputGroup>
        <SubmitButton size="sm" variant="outline" pendingText="Saving…">
          Set
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
