"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { reviewAgencyTopup } from "@/modules/agencies/admin-actions";

/**
 * Confirming a top-up is confirming that money physically arrived — a bank
 * statement line, an EVC transaction, cash in a drawer. Approving credits
 * the wallet immediately, so it is a two-click action with the amount and
 * the agent's own reference in view, never a bulk sweep.
 */
export function TopupReview({ agencyId, requestId }: { agencyId: string; requestId: string }) {
  const [approveState, approveAction] = useActionState(reviewAgencyTopup, null);
  const [rejectState, rejectAction] = useActionState(reviewAgencyTopup, null);
  const [rejecting, setRejecting] = useState(false);
  const error = approveState?.error ?? rejectState?.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="approved" />
          <SubmitButton size="sm" pendingText="Crediting…">
            <Check data-icon="inline-start" /> Received
          </SubmitButton>
        </form>
        <Button
          type="button"
          size="sm"
          variant={rejecting ? "destructive" : "outline"}
          aria-expanded={rejecting}
          onClick={() => setRejecting((v) => !v)}
        >
          <X data-icon="inline-start" /> Not received
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="rejected" />
          <Textarea
            name="note"
            placeholder="What the agency should check (shown to them)"
            rows={2}
            required
            aria-label="Reason"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Saving…">
              Reject top-up
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
