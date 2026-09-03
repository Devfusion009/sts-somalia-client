"use client";

import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { deleteAgencyMarkup, withdrawMarkupRequest } from "@/modules/agencies/markup-actions";

/** Pulls a pending change request back before an admin acts on it. */
export function WithdrawRequestButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Withdraw
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={withdrawMarkupRequest} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="requestId" value={requestId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Withdrawing…">
                Withdraw
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Files a removal request for a live rule — the rule stays in force until an admin approves it. */
export function RequestRemovalButton({ markupId }: { markupId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" /> Request removal
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={deleteAgencyMarkup} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="markupId" value={markupId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Request removal of this rule?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Submitting…">
                Request removal
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
