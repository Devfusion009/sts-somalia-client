"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCog, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
  size = "sm",
}: {
  orderId: string;
  kind: Kind;
  currency: string;
  disabled?: boolean;
  /** Trigger size; "default" when it sits among page-header actions. */
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const copy = COPY[kind];
  const Icon = ICON[kind];

  const openRequest = trpc.bookings.openRequest.useMutation({
    onSuccess: () => {
      setOpen(false);
      toast.success("Request sent.");
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
      <Button variant="outline" size={size} disabled={disabled} onClick={() => setOpen(true)}>
        <Icon data-icon="inline-start" aria-hidden="true" /> {copy.trigger}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${kind}-reason`}>Details</FieldLabel>
                <Textarea
                  id={`${kind}-reason`}
                  name="reason"
                  rows={4}
                  required
                  minLength={10}
                  placeholder={copy.placeholder}
                />
              </Field>

              {copy.showAmount ? (
                <Field>
                  <FieldLabel htmlFor={`${kind}-amount`}>Amount claimed (optional)</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>{currency}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id={`${kind}-amount`}
                      name="requestedAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="tabular-nums"
                      placeholder="Leave blank and we'll calculate what's due"
                    />
                  </InputGroup>
                </Field>
              ) : null}

              <FieldError>{openRequest.error?.message}</FieldError>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Sending…">Send request</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
