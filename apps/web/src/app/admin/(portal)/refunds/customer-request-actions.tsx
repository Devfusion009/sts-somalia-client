"use client";

import { useActionState, useState } from "react";
import { Check, Banknote, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { decideCustomerRequest, type AdminRequestState } from "@/modules/bookings/admin-request-actions";

type Decision = "approved" | "rejected" | "completed";

const DONE: Record<Decision, string> = {
  approved: "Request approved.",
  rejected: "Request declined.",
  completed: "Refund marked paid.",
};

const TITLE: Record<Decision, string> = {
  approved: "Approve request",
  rejected: "Decline request",
  completed: "Mark refund paid",
};

export function CustomerRequestActions({
  requestId,
  status,
  kind,
  currency,
  suggestedAmount,
}: {
  requestId: string;
  status: string;
  kind: string;
  currency: string;
  suggestedAmount: number;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  // Controlled so a refused amount stays in the field: React resets an
  // uncontrolled action form after every submit, error or not.
  const [amount, setAmount] = useState(String(suggestedAmount));
  function openDecision(next: Decision) {
    setAmount(String(suggestedAmount));
    setDecision(next);
  }
  const [, formAction] = useActionState<AdminRequestState, FormData>(async (prev, formData) => {
    const result = await decideCustomerRequest(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success(DONE[formData.get("decision") as Decision] ?? "Saved.", { position: "top-center" });
      setDecision(null);
    }
    return result;
  }, null);

  const open = status === "requested" || status === "in_review";
  const refunds = kind !== "modification";

  return (
    <>
      <div className="flex justify-end gap-2">
        {open ? (
          <>
            <Button size="sm" onClick={() => openDecision("approved")}>
              <Check aria-hidden="true" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDecision("rejected")}>
              <X aria-hidden="true" /> Decline
            </Button>
          </>
        ) : status === "approved" && refunds ? (
          <Button size="sm" variant="outline" onClick={() => openDecision("completed")}>
            <Banknote aria-hidden="true" /> Mark paid
          </Button>
        ) : null}
      </div>

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decision ? TITLE[decision] : ""}</DialogTitle>
          </DialogHeader>
          <form action={formAction}>
            <FieldGroup className="gap-4">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="decision" value={decision ?? ""} />
              {decision === "approved" && refunds ? (
                <Field>
                  <FieldLabel htmlFor={`amt-${requestId}`}>Refund amount ({currency})</FieldLabel>
                  <Input
                    id={`amt-${requestId}`}
                    name="amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="tabular-nums"
                  />
                </Field>
              ) : null}
              {decision !== "completed" ? (
                <Field>
                  <FieldLabel htmlFor={`note-${requestId}`}>Note to customer</FieldLabel>
                  <Textarea id={`note-${requestId}`} name="note" rows={3} maxLength={500} />
                </Field>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDecision(null)}>
                  Cancel
                </Button>
                <SubmitButton variant={decision === "rejected" ? "destructive" : "default"} pendingText="Saving…">
                  Confirm
                </SubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
