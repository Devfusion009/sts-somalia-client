"use client";

import { useActionState, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { setDocumentReviewStatus } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

type ReviewStatus = "pending" | "verified" | "rejected";

const STATUS_META: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Not reviewed", variant: "neutral" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

/**
 * Review strip under one document row: status + who/when on the left, icon
 * actions (open, verify, reject) on the right; reject expands a reason form.
 */
export function DocumentReviewControls({
  applicationId,
  type,
  docKey,
  status,
  note,
  reviewedAt,
  reviewerName,
  viewUrl,
}: {
  applicationId: string;
  type: ApplicationType;
  docKey: string;
  status: ReviewStatus;
  note: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  /** Signed URL of the file; renders an open action beside verify/reject. */
  viewUrl?: string | null;
}) {
  const [verifyState, verifyAction] = useActionState(setDocumentReviewStatus.bind(null, type), null);
  const [rejectState, rejectAction] = useActionState(setDocumentReviewStatus.bind(null, type), null);
  const [rejecting, setRejecting] = useState(false);
  const meta = STATUS_META[status];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {status !== "pending" && reviewedAt ? (
            <span className="text-xs text-muted-foreground">
              {reviewerName ? `${reviewerName} · ` : ""}
              {formatDistanceToNow(new Date(reviewedAt), { addSuffix: true })}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {viewUrl ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open document"
              title="Open document"
              render={<a href={viewUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink />
            </Button>
          ) : null}
          <form action={verifyAction}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="docKey" value={docKey} />
            <input type="hidden" name="status" value="verified" />
            <SubmitButton
              size="icon-sm"
              variant={status === "verified" ? "default" : "outline"}
              aria-label="Verify document"
              title="Verify"
              pendingText=""
            >
              <Check />
            </SubmitButton>
          </form>
          <Button
            type="button"
            size="icon-sm"
            variant={status === "rejected" || rejecting ? "destructive" : "outline"}
            aria-label="Reject document"
            aria-expanded={rejecting}
            title="Reject"
            onClick={() => setRejecting((v) => !v)}
          >
            <X />
          </Button>
        </div>
      </div>

      {status === "rejected" && note ? <p className="text-xs break-words text-destructive">{note}</p> : null}
      {verifyState?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {verifyState.error}
        </p>
      ) : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={docKey} />
          <input type="hidden" name="status" value="rejected" />
          <Textarea
            name="note"
            placeholder="Reason (shown to the applicant)"
            aria-label="Rejection reason"
            defaultValue={note ?? ""}
            rows={2}
            required
          />
          {rejectState?.error ? (
            <p role="alert" className="text-xs text-destructive">
              {rejectState.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Rejecting…">
              Reject document
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
