"use client";

import { useActionState } from "react";
import { trpc } from "@/lib/trpc/react";
import { Check, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateHotelBookingStatus, updateHallBookingStatus } from "@/modules/admin/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Wraps a server action so success raises a toast from the call itself — the
 * queue row unmounts as soon as the decision lands, so an effect on the
 * returned state would never get to run.
 */
function withToast(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  message: (formData: FormData) => string,
  onSuccess?: () => void
) {
  return async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else { onSuccess?.(); toast.success(message(formData), { position: "top-center" }); }
    return result;
  };
}

export type QueueKind = "hotel" | "hall";

const STATUS_ACTIONS = {
  hotel: updateHotelBookingStatus,
  hall: updateHallBookingStatus,
} as const;


/**
 * Confirm / Decline for one queue entry. Confirming a waitlisted hotel
 * booking is a promotion — the DB re-checks availability at that instant and
 * the error ("still not enough rooms available on <date>") surfaces inline,
 * so a stale waitlist entry can't silently double-book.
 */
export function QueueEntryActions({ kind, bookingId }: { kind: QueueKind; bookingId: string }) {
  const utils = trpc.useUtils();
  const refreshCount = () => { void utils.notifications.adminNavCounts.invalidate(); };
  const action = STATUS_ACTIONS[kind];
  const [confirmState, confirmAction] = useActionState(
    withToast(action, () => "Booking confirmed.", refreshCount),
    null
  );
  const [declineState, declineAction] = useActionState(
    withToast(action, () => "Request declined.", refreshCount),
    null
  );
  const error = confirmState?.error ?? declineState?.error;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="confirmed" />
          <SubmitButton pendingText="Confirming…">
            <Check aria-hidden="true" /> Confirm
          </SubmitButton>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value="cancelled" />
          <ConfirmButton
            title="Decline this request?"
            confirmLabel="Decline"
            icon="x"
            variant="outline"
            className="text-destructive hover:text-destructive"
          >
            <X aria-hidden="true" /> Decline
          </ConfirmButton>
        </form>
      </div>
      {error ? (
        <p role="alert" className="max-w-64 text-xs text-destructive sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
