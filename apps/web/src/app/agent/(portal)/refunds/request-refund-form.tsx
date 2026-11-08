"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { money } from "@/lib/money";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { requestAgencyRefundAction } from "@/modules/agencies/refund-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export function RequestRefundForm({
  orders,
  initialOrderId,
}: {
  orders: { id: string; order_number: string; total: number; currency: string }[];
  /** Opened from a booking page: start with that order chosen. */
  initialOrderId?: string;
}) {
  const preselect = initialOrderId && orders.some((o) => o.id === initialOrderId) ? initialOrderId : "";
  const [open, setOpen] = useState(Boolean(preselect));
  const [state, formAction] = useActionState(requestAgencyRefundAction, null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      setOpen(false);
      submitted.current = false;
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" /> Request a refund
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="orderId">Order</FieldLabel>
              <select id="orderId" name="orderId" defaultValue={preselect} required className={NATIVE_SELECT_CLASS}>
                <option value="" disabled>
                  Choose an order
                </option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} — {money(Number(o.total), o.currency)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">
                Amount (USD) <span className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  required
                  className="tabular-nums"
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea id="reason" name="reason" rows={3} placeholder="Guest cancelled, hotel already refunded us" required />
            </Field>
            <FieldError>{state?.error}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Submitting…">Submit request</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
