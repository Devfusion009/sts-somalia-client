"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { rescheduleHallBooking, saveHallBookingNotes } from "@/modules/events/venue-manager-actions";

function withToast(action: (prev: ActionState, formData: FormData) => Promise<ActionState>, success: string) {
  return async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) toast.success(success, { position: "top-center" });
    return result;
  };
}

/** Move a live booking to another slot; the database refuses a taken or blocked one. */
export function RescheduleForm({
  venueId,
  bookingId,
  today,
  current,
}: {
  venueId: string;
  bookingId: string;
  today: string;
  current: { startDate: string; endDate: string; startTime: string | null; endTime: string | null };
}) {
  const [state, formAction] = useActionState(withToast(rescheduleHallBooking, "Booking moved."), null);
  const [start, setStart] = useState(current.startDate < today ? today : current.startDate);
  const [end, setEnd] = useState(current.endDate < today ? today : current.endDate);
  const [from, setFrom] = useState(current.startTime ?? "");
  const [to, setTo] = useState(current.endTime ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="rs-start">Start date</FieldLabel>
          <Input
            id="rs-start"
            name="startDate"
            type="date"
            min={today}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (end < e.target.value) setEnd(e.target.value);
            }}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="rs-end">End date</FieldLabel>
          <Input id="rs-end" name="endDate" type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="rs-from">Start time</FieldLabel>
          <Input id="rs-from" name="startTime" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rs-to">End time</FieldLabel>
          <Input id="rs-to" name="endTime" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton variant="outline" pendingText="Moving…">
          Move booking
        </SubmitButton>
      </div>
    </form>
  );
}

/** Staff-only notes: setup, catering, supplier contacts. */
export function BookingNotesForm({ venueId, bookingId, notes }: { venueId: string; bookingId: string; notes: string | null }) {
  const [state, formAction] = useActionState(withToast(saveHallBookingNotes, "Notes saved."), null);
  const [value, setValue] = useState(notes ?? "");

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <Textarea
        name="notes"
        rows={4}
        maxLength={2000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Setup, catering, supplier contacts"
        aria-label="Internal notes"
      />
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton variant="outline" pendingText="Saving…" disabled={value === (notes ?? "")}>
          Save notes
        </SubmitButton>
      </div>
    </form>
  );
}
