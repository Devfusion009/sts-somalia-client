"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { nextHotelBookingMoves } from "@/modules/hotels/booking-transitions";
import type { ActionState } from "@/lib/auth/actions";

/**
 * The decision buttons for one hotel booking: only the moves its status
 * allows (see nextHotelBookingMoves), so a request shows Confirm / Decline,
 * a confirmed stay shows Cancel until check-in and Complete / No-show after.
 * A booking with no moves left renders nothing. Used by the admin, partner
 * and manager consoles; each passes its own authorized action.
 */
export function BookingMoveActions({
  bookingId,
  status,
  checkIn,
  today,
  action,
}: {
  bookingId: string;
  status: string;
  checkIn: string;
  today: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const moves = nextHotelBookingMoves(status, checkIn, today);

  if (moves.length === 0) return null;

  const isRequest = status === "pending" || status === "waitlisted";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {moves.map((move) => (
          <form key={move} action={formAction}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="status" value={move} />
            {move === "confirmed" ? (
              <SubmitButton size="sm" pendingText="Confirming…" className="gap-1">
                <Check className="size-3.5" /> Confirm
              </SubmitButton>
            ) : move === "completed" ? (
              <SubmitButton size="sm" variant="outline" pendingText="Saving…" className="gap-1">
                <Check className="size-3.5" /> Complete
              </SubmitButton>
            ) : move === "no_show" ? (
              <ConfirmButton
                title="Mark this booking as no-show?"
                confirmLabel="Mark no-show"
                icon="ban"
                size="sm"
                variant="outline"
              >
                No-show
              </ConfirmButton>
            ) : (
              <ConfirmButton
                title={isRequest ? "Decline this request?" : "Cancel this booking?"}
                confirmLabel={isRequest ? "Decline" : "Cancel booking"}
                icon="x"
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:text-destructive"
              >
                <X className="size-3.5" /> {isRequest ? "Decline" : "Cancel"}
              </ConfirmButton>
            )}
          </form>
        ))}
      </div>
      {state?.error ? <p className="max-w-56 text-right text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}
