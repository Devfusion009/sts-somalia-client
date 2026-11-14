"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { retryFlightTicketing, type FlightAdminState } from "@/modules/flights/admin-actions";

export function RetryTicketingForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState<FlightAdminState, FormData>(retryFlightTicketing, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-muted-foreground">{state.ok}</span> : null}
      <SubmitButton size="sm" variant="outline" pendingText="Queuing…">
        <RotateCcw aria-hidden="true" /> Retry booking
      </SubmitButton>
    </form>
  );
}
