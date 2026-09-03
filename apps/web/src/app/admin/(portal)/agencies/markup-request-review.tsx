"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { reviewMarkupRequest } from "@/modules/admin/agency-markup-actions";

export function MarkupRequestReview({ requestId, agencyId }: { requestId: string; agencyId: string }) {
  const [approveState, approveAction] = useActionState(reviewMarkupRequest, null);
  const [rejectState, rejectAction] = useActionState(reviewMarkupRequest, null);
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="approved" />
          <SubmitButton size="sm" className="gap-1" pendingText="Approving…">
            <CheckCircle2 className="size-3.5" /> Approve
          </SubmitButton>
        </form>
        <Button
          type="button"
          size="sm"
          variant={rejecting ? "destructive" : "outline"}
          className="gap-1"
          onClick={() => setRejecting((v) => !v)}
        >
          <XCircle className="size-3.5" /> Reject
        </Button>
      </div>
      {approveState?.error ? <p className="text-right text-xs text-destructive">{approveState.error}</p> : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="rejected" />
          <Textarea name="note" placeholder="Reason (shown to the agency)" rows={2} required />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Rejecting…">
              Confirm rejection
            </SubmitButton>
          </div>
          {rejectState?.error ? <p className="text-right text-xs text-destructive">{rejectState.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
