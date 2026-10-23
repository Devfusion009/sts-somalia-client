"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { HALL_MOVE_LABEL, nextHallBookingMoves } from "@/modules/events/hall-transitions";

const MOVE_MESSAGES: Record<string, string> = {
  confirmed: "Booking confirmed.",
  cancelled: "Booking cancelled.",
  completed: "Event completed.",
  no_show: "Marked as no-show.",
  refunded: "Marked refunded.",
};

/**
 * Decision buttons for one hall booking: only the moves its status and dates
 * allow (see nextHallBookingMoves). Shared by the venue manager, venue partner
 * and admin consoles; each passes its own authorized action and the hidden
 * fields that action reads.
 */
export function HallMoveActions({
  booking,
  today,
  isAdmin = false,
  paid = true,
  action,
  fields,
}: {
  booking: { id: string; status: string; start_date: string; end_date: string; price: number | string };
  today: string;
  isAdmin?: boolean;
  /** False hides "Mark refunded": nothing was paid, so nothing goes back. */
  paid?: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields?: Record<string, string>;
}) {
  const [, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else toast.success(MOVE_MESSAGES[String(formData.get("status"))] ?? "Saved.", { position: "top-center" });
    return result;
  }, null);
  const moves = nextHallBookingMoves(booking, today, isAdmin).filter((m) => paid || m !== "refunded");
  if (moves.length === 0) return null;
  const isRequest = booking.status === "pending" || booking.status === "waitlisted";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {moves.map((move) => (
        <form key={move} action={formAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="status" value={move} />
          {Object.entries(fields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {move === "confirmed" ? (
            <SubmitButton size="sm" pendingText="Confirming…" className="gap-1" disabled={Number(booking.price) <= 0}>
              <Check className="size-3.5" /> Confirm
            </SubmitButton>
          ) : move === "completed" ? (
            <SubmitButton size="sm" variant="outline" pendingText="Saving…" className="gap-1">
              <Check className="size-3.5" /> Complete
            </SubmitButton>
          ) : move === "cancelled" ? (
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
          ) : (
            <ConfirmButton
              title={`${HALL_MOVE_LABEL[move]}?`}
              confirmLabel={HALL_MOVE_LABEL[move]}
              icon="ban"
              size="sm"
              variant="outline"
            >
              {HALL_MOVE_LABEL[move]}
            </ConfirmButton>
          )}
        </form>
      ))}
    </div>
  );
}
