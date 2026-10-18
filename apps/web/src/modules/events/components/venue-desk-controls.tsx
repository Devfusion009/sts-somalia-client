"use client";

import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  blockVenueDates,
  quoteHallBookingPrice,
  setHallBookingStatus,
} from "@/modules/events/venue-manager-actions";
import { HallMoveActions } from "@/modules/events/components/hall-move-actions";

type DeskBookingRef = { id: string; status: string; start_date: string; end_date: string; price: number | string };

/** The booking's allowed moves as buttons; the allocator's refusal shows as a toast. */
export function DeskStatusControl({ venueId, booking, today }: { venueId: string; booking: DeskBookingRef; today: string }) {
  return <HallMoveActions booking={booking} today={today} action={setHallBookingStatus} fields={{ venueId }} />;
}

/** Confirm / decline for a request card. */
export function DeskDecision({ venueId, booking, today }: { venueId: string; booking: DeskBookingRef; today: string }) {
  return <HallMoveActions booking={booking} today={today} action={setHallBookingStatus} fields={{ venueId }} />;
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
