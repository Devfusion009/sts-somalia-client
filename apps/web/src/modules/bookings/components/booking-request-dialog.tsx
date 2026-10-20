"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCog, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";

type Kind = "cancellation" | "refund" | "modification";

const COPY: Record<
  Kind,
  { trigger: string; title: string; placeholder: string; showAmount: boolean }
> = {
  cancellation: {
    trigger: "Request cancellation",
    title: "Request a cancellation",
    placeholder: "Tell us which part of the booking you need to cancel, and why.",
    showAmount: false,
  },
  refund: {
    trigger: "Request refund",
    title: "Request a refund",
    placeholder: "Explain what you'd like refunded and why.",
    showAmount: true,
  },
  modification: {
    trigger: "Request a change",
    title: "Request a change",
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
  const router = useRouter();
  const copy = COPY[kind];
  const Icon = ICON[kind];

  const openRequest = trpc.bookings.openRequest.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  async function handleSubmit(formData: FormData) {
    try {
      const rawAmount = formData.get("requestedAmount") as string;
      await openRequest.mutateAsync({
        orderId,
        kind,
        reason: formData.get("reason") as string,
        requestedAmount: rawAmount ? Number(rawAmount) : undefined,
      });
    } catch {
      // handled via openRequest.error
    }
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
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            {openRequest.error ? (
              <Alert variant="destructive">
                <AlertDescription>{openRequest.error.message}</AlertDescription>
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
