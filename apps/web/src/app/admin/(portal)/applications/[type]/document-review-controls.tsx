"use client";

import { useActionState, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { setDocumentReviewStatus } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

type ReviewStatus = "pending" | "verified" | "rejected";

const STATUS_META: Record<ReviewStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Not yet reviewed", className: "bg-muted text-muted-foreground", icon: Clock3 },
  verified: { label: "Verified", className: "bg-primary/10 text-primary", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

export function DocumentReviewControls({
  applicationId,
  type,
  docKey,
  status,
  note,
  reviewedAt,
  reviewerName,
}: {
  applicationId: string;
  type: ApplicationType;
  docKey: string;
  status: ReviewStatus;
  note: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
}) {
  const [verifyState, verifyAction] = useActionState(setDocumentReviewStatus.bind(null, type), null);
  const [rejectState, rejectAction] = useActionState(setDocumentReviewStatus.bind(null, type), null);
  const [rejecting, setRejecting] = useState(false);
  const meta = STATUS_META[status];

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`gap-1 border-transparent font-normal ${meta.className}`}>
          <meta.icon className="size-3" /> {meta.label}
        </Badge>
        {status !== "pending" && reviewedAt ? (
          <span className="text-xs text-muted-foreground">
            {reviewerName ? `by ${reviewerName} · ` : ""}
            {formatDistanceToNow(new Date(reviewedAt), { addSuffix: true })}
          </span>
        ) : null}
      </div>

      {status === "rejected" && note ? <p className="text-xs text-destructive">Reason: {note}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <form action={verifyAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={docKey} />
          <input type="hidden" name="status" value="verified" />
          <SubmitButton
            size="sm"
            variant={status === "verified" ? "default" : "outline"}
            className="gap-1"
            pendingText="Verifying…"
          >
            <CheckCircle2 className="size-3.5" /> Verify
          </SubmitButton>
        </form>
        <Button
          type="button"
          size="sm"
          variant={status === "rejected" ? "destructive" : "outline"}
          className="gap-1"
          onClick={() => setRejecting((v) => !v)}
        >
          <XCircle className="size-3.5" /> Reject
        </Button>
      </div>
      {verifyState?.error ? <p className="text-xs text-destructive">{verifyState.error}</p> : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="docKey" value={docKey} />
          <input type="hidden" name="status" value="rejected" />
          <Textarea name="note" placeholder="Why is this document being rejected? (visible to the applicant)" defaultValue={note ?? ""} rows={2} required />
          <div className="flex gap-1.5">
            <SubmitButton size="sm" variant="destructive" pendingText="Rejecting…">
              Confirm rejection
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
          {rejectState?.error ? <p className="text-xs text-destructive">{rejectState.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
