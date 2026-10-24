"use client";

import { useActionState } from "react";
import { AlertCircle, CalendarCheck2, Eraser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { setRoomInventoryAdmin, clearRoomInventoryAdmin } from "@/modules/admin/actions";

const today = new Date().toISOString().slice(0, 10);

/** Admin equivalent of partner/hotels/[id]/rooms/[roomId]/inventory-form.tsx — same UI, admin-scoped actions. */
export function InventoryRangeForm({ hotelId, roomId, currency }: { hotelId: string; roomId: string; currency: string }) {
  const [state, formAction] = useActionState(setRoomInventoryAdmin, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={roomId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="startDate">From</FieldLabel>
          <Input id="startDate" name="startDate" type="date" min={today} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="endDate">To (inclusive)</FieldLabel>
          <Input id="endDate" name="endDate" type="date" min={today} required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="totalUnits">Rooms to sell</FieldLabel>
          <Input
            id="totalUnits"
            name="totalUnits"
            type="number"
            min={0}
            max={1000}
            placeholder="Unchanged"
            className="tabular-nums"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="priceOverride">Price per night ({currency})</FieldLabel>
          <Input
            id="priceOverride"
            name="priceOverride"
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Unchanged"
            className="tabular-nums"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">
          <CalendarCheck2 aria-hidden="true" /> Save override
        </SubmitButton>
      </div>
    </form>
  );
}

export function ClearInventoryForm({ hotelId, roomId }: { hotelId: string; roomId: string }) {
  const [state, formAction] = useActionState(clearRoomInventoryAdmin, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={roomId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="clearStart">From</FieldLabel>
          <Input id="clearStart" name="startDate" type="date" min={today} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="clearEnd">To (inclusive)</FieldLabel>
          <Input id="clearEnd" name="endDate" type="date" min={today} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton variant="outline" pendingText="Clearing…">
          <Eraser aria-hidden="true" /> Clear overrides
        </SubmitButton>
      </div>
    </form>
  );
}
