"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { approveRefundRequestAction, rejectRefundRequestAction } from "@/modules/agencies/admin-actions";

export function RefundRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [approveState, approveAction] = useActionState(approveRefundRequestAction, null);
  const [rejectState, rejectAction] = useActionState(rejectRefundRequestAction, null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [lastRejectState, setLastRejectState] = useState(rejectState);
  if (rejectState !== lastRejectState) {
    setLastRejectState(rejectState);
    if (rejectState && !rejectState.error) setRejectOpen(false);
  }

  useEffect(() => {
    if ((approveState && !approveState.error) || (rejectState && !rejectState.error)) {
      router.refresh();
    }
  }, [approveState, rejectState, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <SubmitButton size="sm" pendingText="Approving…">
            <Check aria-hidden="true" /> Approve
          </SubmitButton>
        </form>
        <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
          <X aria-hidden="true" /> Reject
        </Button>
      </div>
      {approveState?.error ? (
        <span role="alert" title={approveState.error} className="flex max-w-64 items-center gap-1 text-xs whitespace-normal text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {approveState.error}
        </span>
      ) : null}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <form action={rejectAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this refund request?</AlertDialogTitle>
            </AlertDialogHeader>
            {rejectState?.error ? (
              <Alert variant="destructive" className="my-2">
                <AlertDescription>{rejectState.error}</AlertDescription>
              </Alert>
            ) : null}
            <Textarea name="notes" aria-label="Reason" placeholder="Reason (shown to the agency)" className="my-2" rows={3} />
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Rejecting…">
                Reject
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
