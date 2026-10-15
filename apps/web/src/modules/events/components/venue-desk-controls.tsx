"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import {
  blockVenueDates,
  quoteHallBookingPrice,
  setHallBookingStatus,
} from "@/modules/events/venue-manager-actions";
import { DESK_STATUSES } from "@/modules/events/venue-desk-types";
import { ConfirmButton, ConfirmDialog } from "@/components/ui/confirm-button";

/** Status select that submits on change; the allocator's refusal shows inline. */
export function DeskStatusControl({ venueId, bookingId, status }: { venueId: string; bookingId: string; status: string }) {
  const [state, formAction] = useActionState(setHallBookingStatus, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(status);
  const [asking, setAsking] = useState<string | null>(null);
  const options: string[] = (DESK_STATUSES as readonly string[]).includes(status)
    ? [...DESK_STATUSES]
    : [status, ...DESK_STATUSES];

  function commit(next: string) {
    setValue(next);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <form action={formAction} ref={formRef} className="space-y-1">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="status" value={value} />
      <Select
        value={value}
        onValueChange={(next) => {
          if (!next || next === value) return;
          if (next === "cancelled" || next === "no_show") setAsking(next);
          else commit(next);
        }}
      >
        <SelectTrigger size="sm" className="w-32 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="capitalize" disabled={!(DESK_STATUSES as readonly string[]).includes(opt)}>
              {opt.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state?.error ? <p className="max-w-48 text-xs text-destructive">{state.error}</p> : null}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={asking === "no_show" ? "Mark this booking as no-show?" : "Cancel this booking?"}
        confirmLabel={asking === "no_show" ? "Mark no-show" : "Cancel booking"}
        icon="ban"
        onConfirm={() => {
          if (asking) commit(asking);
          setAsking(null);
        }}
      />
    </form>
  );
}

/** One-click confirm / decline for a request card. */
export function DeskDecision({ venueId, bookingId }: { venueId: string; bookingId: string }) {
  const [state, formAction] = useActionState(setHallBookingStatus, null);
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="confirmed" />
          <SubmitButton size="sm" className="gap-1" pendingText="Confirming…">
            <Check className="size-3.5" /> Confirm
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="cancelled" />
          <ConfirmButton
            title="Decline this booking request?"
            confirmLabel="Decline"
            icon="ban"
            size="sm"
            variant="outline"
            className="gap-1 text-destructive hover:text-destructive"
          >
            <Ban className="size-3.5" /> Decline
          </ConfirmButton>
        </form>
      </div>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}

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
  const [state, formAction] = useActionState(quoteHallBookingPrice, null);
  const [value, setValue] = useState(String(price));

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{currency}</span>
        <Input
          name="price"
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-24"
          aria-label="Price"
        />
        <SubmitButton size="sm" variant="outline" pendingText="…" disabled={Number(value) === price}>
          Save
        </SubmitButton>
      </div>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function BlockDatesForm({ venueId, today }: { venueId: string; today: string }) {
  const [state, formAction] = useActionState(blockVenueDates, null);
  const [start, setStart] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="venueId" value={venueId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="block-start">From</Label>
          <Input
            id="block-start"
            name="dateStart"
            type="date"
            min={today}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="block-end">To</Label>
          <Input id="block-end" name="dateEnd" type="date" min={start || today} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="block-reason">Reason</Label>
        <Input id="block-reason" name="reason" maxLength={200} placeholder="Maintenance, private use" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="outline" className="w-full gap-1.5">
        <Ban className="size-3.5" /> Block dates
      </Button>
    </form>
  );
}
