"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { decideBookingRequest, type RefundActionState } from "@/modules/hotels/refund-actions";

/** Approve or decline one customer request. Approving a cancellation or refund cancels the stay. */
export function RequestDecision({
  scopeId,
  scopeName = "hotelId",
  action = decideBookingRequest,
  requestId,
  kind,
  currency,
  suggestedAmount,
  maxAmount,
}: {
  scopeId: string;
  scopeName?: "hotelId" | "venueId";
  action?: (prev: RefundActionState, formData: FormData) => Promise<RefundActionState>;
  requestId: string;
  kind: "cancellation" | "refund" | "modification";
  currency: string;
  suggestedAmount: number;
  maxAmount: number;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [state, formAction] = useActionState<RefundActionState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success(formData.get("decision") === "approved" ? "Request approved." : "Request declined.", { position: "top-center" });
      setDecision(null);
    }
    return result;
  }, null);

  const refunds = kind !== "modification";

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="gap-1" onClick={() => setDecision("approved")}>
          <Check className="size-3.5" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-destructive hover:text-destructive"
          onClick={() => setDecision("rejected")}
        >
          <X className="size-3.5" /> Decline
        </Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decision === "approved" ? "Approve request" : "Decline request"}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name={scopeName} value={scopeId} />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="decision" value={decision ?? ""} />
            {decision === "approved" && refunds ? (
              <div className="space-y-1.5">
                <Label htmlFor={`amount-${requestId}`}>Refund amount ({currency})</Label>
                <Input
                  id={`amount-${requestId}`}
                  name="amount"
                  type="number"
                  min={0}
                  max={maxAmount}
                  step="0.01"
                  defaultValue={suggestedAmount}
                  required
                  aria-invalid={Boolean(state?.error)}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`note-${requestId}`}>Note to guest</Label>
              <Textarea id={`note-${requestId}`} name="note" rows={3} maxLength={500} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <SubmitButton variant={decision === "rejected" ? "destructive" : "default"} pendingText="Saving…">
                {decision === "approved" ? "Approve" : "Decline"}
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
