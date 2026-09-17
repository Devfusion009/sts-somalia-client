"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  advanceUmrahStage,
  deleteUmrahDocument,
  uploadUmrahDocument,
  type FulfillmentActionState,
} from "@/modules/umrah/fulfillment-admin-actions";
import { UMRAH_DOC_TYPES, UMRAH_DOC_TYPE_LABELS, UMRAH_STAGE_LABELS, type UmrahStage } from "../stages";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function useRefreshOnSuccess(state: FulfillmentActionState, onSuccess?: () => void) {
  const router = useRouter();
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) onSuccess?.();
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);
}

export function StageForm({ bookingId, nextStages }: { bookingId: string; nextStages: UmrahStage[] }) {
  const [state, formAction] = useActionState(advanceUmrahStage, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="stage">Move to</Label>
        <select id="stage" name="stage" className={selectClass} defaultValue={nextStages[0]} required>
          {nextStages.map((s) => (
            <option key={s} value={s}>
              {UMRAH_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stage-note">Note</Label>
        <Textarea id="stage-note" name="note" rows={2} maxLength={500} placeholder="Optional" />
      </div>
      <SubmitButton pendingText="Updating…">Update stage</SubmitButton>
    </form>
  );
}

export function DocumentUploadForm({
  bookingId,
  pilgrims,
}: {
  bookingId: string;
  pilgrims: { id: string; full_name: string }[];
}) {
  const [state, formAction] = useActionState(uploadUmrahDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="docType">Type</Label>
          <select id="docType" name="docType" className={selectClass} defaultValue="visa" required>
            {UMRAH_DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {UMRAH_DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pilgrimId">Pilgrim</Label>
          <select id="pilgrimId" name="pilgrimId" className={selectClass} defaultValue="">
            <option value="">Whole booking</option>
            {pilgrims.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="docTitle">Title</Label>
        <Input id="docTitle" name="title" maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="docFile">File</Label>
        <Input
          id="docFile"
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
      </div>
      <SubmitButton pendingText="Uploading…">
        <Upload /> Upload
      </SubmitButton>
    </form>
  );
}

export function DeleteDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const [state, formAction] = useActionState(deleteUmrahDocument, null);
  const [open, setOpen] = useState(false);
  useRefreshOnSuccess(state, () => setOpen(false));

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        aria-label={`Delete ${title}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="documentId" value={documentId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? <p className="my-2 text-xs text-destructive">{state.error}</p> : null}
            <AlertDialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Deleting…">
                Delete
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
