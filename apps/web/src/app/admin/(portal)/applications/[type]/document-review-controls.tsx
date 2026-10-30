"use client";

import { useActionState, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";
import { setDocumentReviewStatus } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

type ReviewStatus = "pending" | "verified" | "rejected";

const STATUS_META: Record<ReviewStatus, { label: string; className: string }> = {
  pending: {
    label: "Not reviewed",
    className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  },
  verified: {
    label: "Verified",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  },
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
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
              meta.className
            )}
          >
            {meta.label}
          </span>
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
              variant="outline"
              className={cn(
                status === "verified"
                  ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300"
              )}
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
            variant="outline"
            className={cn(
              status === "rejected" || rejecting
                ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:text-white"
                : "border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/40 dark:text-rose-300"
            )}
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
