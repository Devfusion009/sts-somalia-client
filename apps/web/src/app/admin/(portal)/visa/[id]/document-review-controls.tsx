"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { adminReviewDocument } from "@/modules/visa/admin-actions";

/**
 * Accept is one click; rejecting opens a dialog because the reason is
 * mandatory — it is what the applicant sees and acts on.
 */
export function DocumentReviewControls({
  documentId,
  applicationId,
  reviewStatus,
}: {
  documentId: string;
  applicationId: string;
  reviewStatus: string;
}) {
  const [acceptState, acceptAction] = useActionState(adminReviewDocument, null);
  const [rejectState, rejectAction] = useActionState(adminReviewDocument, null);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      {reviewStatus === "pending" ? (
        <form action={acceptAction}>
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="decision" value="accept" />
          <SubmitButton
            size="icon-sm"
            variant="outline"
            aria-label="Accept document"
            title="Accept"
            pendingText=""
          >
            <Check className="text-primary" />
          </SubmitButton>
        </form>
      ) : null}

      {reviewStatus !== "rejected" ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={<Button size="icon-sm" variant="outline" aria-label="Reject document" title="Reject" />}
          >
            <X className="text-destructive" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Reject document</DialogTitle>
            </DialogHeader>
            <form action={rejectAction} className="space-y-3">
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="applicationId" value={applicationId} />
              <input type="hidden" name="decision" value="reject" />
              <Field>
                <FieldLabel htmlFor={`reason-${documentId}`}>Reason</FieldLabel>
                <Textarea
                  id={`reason-${documentId}`}
                  name="reason"
                  rows={3}
                  required
                  placeholder="Passport photo page is cut off"
                />
              </Field>
              {rejectState?.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {rejectState.error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="destructive" pendingText="Rejecting…">
                  Reject document
                </SubmitButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {acceptState?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {acceptState.error}
        </p>
      ) : null}
    </div>
  );
}
