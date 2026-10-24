"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { blockVenueDates, quoteHallBookingPrice } from "@/modules/events/venue-manager-actions";

export function DeskPriceForm({
  venueId,
  bookingId,
  price,
  currency,
}: {
  venueId: string;
  bookingId: string;
  price: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(async (prev: Awaited<ReturnType<typeof quoteHallBookingPrice>>, formData: FormData) => {
    const result = await quoteHallBookingPrice(prev, formData);
    if (!result?.error) toast.success("Price saved.", { position: "top-center" });
    return result;
  }, null);
  const [value, setValue] = useState(price > 0 ? String(price) : "");

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-1.5">
        <InputGroup className="w-36">
          <InputGroupAddon>
            <InputGroupText>{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            name="price"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-right tabular-nums"
            placeholder="Price"
            aria-label={`Price (${currency})`}
            aria-invalid={state?.error ? true : undefined}
          />
        </InputGroup>
        <SubmitButton variant="outline" pendingText="Saving…" disabled={!(Number(value) > 0) || Number(value) === price}>
          Save
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

export function BlockDatesForm({ venueId, today }: { venueId: string; today: string }) {
  // Controlled so a refused block keeps what was typed (React resets uncontrolled fields after an action).
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(async (prev: Awaited<ReturnType<typeof blockVenueDates>>, formData: FormData) => {
    const result = await blockVenueDates(prev, formData);
    if (!result?.error) {
      toast.success("Dates blocked.", { position: "top-center" });
      setStart("");
      setEnd("");
      setReason("");
    }
    return result;
  }, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="venueId" value={venueId} />
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="block-start">From</FieldLabel>
          <Input
            id="block-start"
            name="dateStart"
            type="date"
            min={today}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="block-end">To</FieldLabel>
          <Input
            id="block-end"
            name="dateEnd"
            type="date"
            min={start || today}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="block-reason">Reason</FieldLabel>
        <Input
          id="block-reason"
          name="reason"
          maxLength={200}
          placeholder="Maintenance, private use"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton variant="outline" className="w-full" pendingText="Blocking…">
        <Ban aria-hidden="true" /> Block dates
      </SubmitButton>
    </form>
  );
}
