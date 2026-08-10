"use client";

import { useActionState, useState } from "react";
import { CalendarCog, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { openBookingRequestAction } from "../actions";

type Kind = "cancellation" | "refund" | "modification";

const COPY: Record<
  Kind,
  { trigger: string; title: string; description: string; placeholder: string; showAmount: boolean }
> = {
  cancellation: {
    trigger: "Request cancellation",
    title: "Request a cancellation",
    description:
      "We'll check the supplier's cancellation rules for this booking and come back to you with what it costs before anything is cancelled.",
    placeholder: "Tell us which part of the booking you need to cancel, and why.",
    showAmount: false,
  },
  refund: {
    trigger: "Request refund",
    title: "Request a refund",
    description:
      "Tell us what you're claiming for. Refunds are assessed against the fare rules that applied when you booked, and we'll confirm the amount before processing.",
    placeholder: "Explain what you'd like refunded and why.",
    showAmount: true,
  },
  modification: {
    trigger: "Request a change",
    title: "Request a change",
    description:
      "Date changes, name corrections, extra rooms — describe what you need and we'll quote any supplier fee before making the change.",
    placeholder: "Describe the change you need — new dates, corrected spelling, extra travellers.",
    showAmount: false,
  },
};

const ICON: Record<Kind, typeof Ban> = {
  cancellation: Ban,
  refund: RotateCcw,
  modification: CalendarCog,
};

/**
 * Opens a service request against a paid order.
 *
 * The wording throughout is "request", never "cancel" or "refund" as a
 * completed act — nothing here changes the booking. Promising otherwise in the
 * button label is how a customer ends up at an airport believing a flight was
 * cancelled when it wasn't.
 */
export function BookingRequestDialog({
  orderId,
  kind,
  currency,
  disabled,
}: {
  orderId: string;
  kind: Kind;
  currency: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(openBookingRequestAction, null);
  const copy = COPY[kind];
  const Icon = ICON[kind];

  // Close once the action succeeds. Derived during render rather than in an
  // effect, per this codebase's established pattern (see
  // src/app/affiliate/links/new-link-form.tsx): comparing against the
  // last-seen state avoids the cascading re-render an effect would cause.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Icon className="size-3.5" /> {copy.trigger}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="kind" value={kind} />

            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`${kind}-reason`}>Details</Label>
              <Textarea
                id={`${kind}-reason`}
                name="reason"
                rows={4}
                required
                minLength={10}
                placeholder={copy.placeholder}
              />
            </div>

            {copy.showAmount ? (
              <div className="space-y-2">
                <Label htmlFor={`${kind}-amount`}>
                  Amount claimed ({currency}) — optional
                </Label>
                <Input
                  id={`${kind}-amount`}
                  name="requestedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Leave blank and we'll calculate what's due"
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Sending…">Send request</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
