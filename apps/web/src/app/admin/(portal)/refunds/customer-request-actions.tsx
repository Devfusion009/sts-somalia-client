"use client";

import { useActionState, useState } from "react";
import { Check, Banknote, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { decideCustomerRequest, type AdminRequestState } from "@/modules/bookings/admin-request-actions";

type Decision = "approved" | "rejected" | "completed";

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
  const [, formAction] = useActionState<AdminRequestState, FormData>(async (prev, formData) => {
    const result = await decideCustomerRequest(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Saved.", { position: "top-center" });
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
            <Button size="sm" className="gap-1" onClick={() => setDecision("approved")}>
              <Check className="size-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1" onClick={() => setDecision("rejected")}>
              <X className="size-3.5" /> Decline
            </Button>
          </>
        ) : status === "approved" && refunds ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setDecision("completed")}>
            <Banknote className="size-3.5" /> Mark paid
          </Button>
        ) : null}
      </div>

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decision ? TITLE[decision] : ""}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="decision" value={decision ?? ""} />
            {decision === "approved" && refunds ? (
              <div className="space-y-1.5">
                <Label htmlFor={`amt-${requestId}`}>Refund amount ({currency})</Label>
                <Input id={`amt-${requestId}`} name="amount" type="number" min={0} step="0.01" defaultValue={suggestedAmount} required />
              </div>
            ) : null}
            {decision !== "completed" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`note-${requestId}`}>Note to customer</Label>
                <Textarea id={`note-${requestId}`} name="note" rows={3} maxLength={500} />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <SubmitButton variant={decision === "rejected" ? "destructive" : "default"} pendingText="Saving…">
                Confirm
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
