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
import { Label } from "@/components/ui/label";
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
      {reviewStatus !== "accepted" ? (
        <form action={acceptAction}>
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="decision" value="accept" />
          <Button size="sm" variant="ghost" type="submit" className="gap-1">
            <Check className="size-3.5 text-primary" /> Accept
          </Button>
        </form>
      ) : null}

      {reviewStatus !== "rejected" ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1" />}>
            <X className="size-3.5 text-destructive" /> Reject
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Reject document</DialogTitle>
            </DialogHeader>
            <form action={rejectAction} className="space-y-3">
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="applicationId" value={applicationId} />
              <input type="hidden" name="decision" value="reject" />
              <div className="space-y-2">
                <Label htmlFor={`reason-${documentId}`}>Reason</Label>
                <Textarea
                  id={`reason-${documentId}`}
                  name="reason"
                  rows={3}
                  required
                  placeholder="Passport photo page is cut off"
                />
              </div>
              {rejectState?.error ? (
                <p className="text-xs text-destructive">{rejectState.error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton size="sm" pendingText="Rejecting…">
                  Reject
                </SubmitButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {acceptState?.error ? (
        <p className="text-xs text-destructive">{acceptState.error}</p>
      ) : null}
    </div>
  );
}
