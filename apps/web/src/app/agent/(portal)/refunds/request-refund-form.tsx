"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Plus, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { requestAgencyRefundAction } from "@/modules/agencies/refund-actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function RequestRefundForm({
  orders,
}: {
  orders: { id: string; order_number: string; total: number; currency: string }[];
}) {
  const [open, setOpen] = useState(false);
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
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" /> Request a refund
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-primary" /> Request a refund
          </DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-4"
        >
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="orderId">Order (optional)</Label>
            <select id="orderId" name="orderId" defaultValue="" className={selectClass}>
              <option value="">Not tied to a specific order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.currency} {Number(o.total).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">
              Amount (USD) <span className="text-destructive">*</span>
            </Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="50.00" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="reason" name="reason" rows={3} placeholder="Guest cancelled, hotel already refunded us" required />
          </div>

          <SubmitButton className="w-full" pendingText="Submitting…">
            Submit request
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
