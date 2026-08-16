"use client";

import { useActionState } from "react";
import { updateVenueBookingStatus } from "@/modules/events/venue-partner-actions";

const OPTIONS = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;

/** Auto-submitting status select — same pattern as the hotel partner's BookingStatusControl. */
export function VenueBookingStatusControl({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, formAction] = useActionState(updateVenueBookingStatus, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
