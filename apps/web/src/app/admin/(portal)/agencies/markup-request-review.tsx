"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
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
          <SubmitButton size="sm" pendingText="Approving…">
            <Check data-icon="inline-start" /> Approve
          </SubmitButton>
        </form>
        <Button
          type="button"
          size="sm"
          variant={rejecting ? "destructive" : "outline"}
          aria-expanded={rejecting}
          onClick={() => setRejecting((v) => !v)}
        >
          <X data-icon="inline-start" /> Reject
        </Button>
      </div>
      {approveState?.error ? (
        <p role="alert" className="text-right text-xs text-destructive">
          {approveState.error}
        </p>
      ) : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="rejected" />
          <Textarea name="note" placeholder="Reason (shown to the agency)" rows={2} required aria-label="Rejection reason" />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Rejecting…">
              Reject
            </SubmitButton>
          </div>
          {rejectState?.error ? (
            <p role="alert" className="text-right text-xs text-destructive">
              {rejectState.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
