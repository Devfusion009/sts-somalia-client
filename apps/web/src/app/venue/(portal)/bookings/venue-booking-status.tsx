"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-button";
import { updateVenueBookingStatus } from "@/modules/events/venue-partner-actions";

const OPTIONS = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;

/** Auto-submitting status select; cancel and no-show ask first. */
export function VenueBookingStatusControl({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, formAction] = useActionState(updateVenueBookingStatus, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(status);
  const [asking, setAsking] = useState<string | null>(null);

  function commit(next: string) {
    setValue(next);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="status" value={value} />
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "cancelled" || next === "no_show") setAsking(next);
          else commit(next);
        }}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
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
