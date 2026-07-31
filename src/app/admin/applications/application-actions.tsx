"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ApplicationActions({
  applicationId,
  approveAction,
  rejectAction,
}: {
  applicationId: string;
  approveAction: ServerAction;
  rejectAction: ServerAction;
}) {
  const router = useRouter();
  const [approveState, approveFormAction] = useActionState(approveAction, null);
  const [rejectState, rejectFormAction] = useActionState(rejectAction, null);
  const [open, setOpen] = useState(false);

  // Close the reject dialog once the rejection succeeds (no error returned).
  // Adjusted during render (not in an effect) per React's guidance for
  // deriving state from a prop/state change; router.refresh() is the actual
  // side effect and stays in the effect below.
  const [lastRejectState, setLastRejectState] = useState(rejectState);
  if (rejectState !== lastRejectState) {
    setLastRejectState(rejectState);
    if (rejectState && !rejectState.error) setOpen(false);
  }

  useEffect(() => {
    if ((approveState && !approveState.error) || (rejectState && !rejectState.error)) {
      router.refresh();
    }
  }, [approveState, rejectState, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approveFormAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <SubmitButton size="sm" pendingText="Approving…">
            <Check /> Approve
          </SubmitButton>
        </form>

        <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
          <X /> Reject
        </Button>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <form action={rejectFormAction}>
              <input type="hidden" name="applicationId" value={applicationId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Reject this application?</AlertDialogTitle>
                <AlertDialogDescription>
                  Optionally add a reason — this is stored on the application.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea name="notes" placeholder="Reason (optional)" className="my-2" rows={3} />
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
      {approveState?.error ? (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{approveState.error}</AlertDescription>
        </Alert>
      ) : null}
      {rejectState?.error ? (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{rejectState.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
