"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
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
  cancelUmrahBooking,
  deleteUmrahDocument,
  deleteUmrahSegment,
  reviewUmrahDocument,
  saveUmrahSegment,
  uploadUmrahDocument,
  type FulfillmentActionState,
} from "@/modules/umrah/fulfillment-admin-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { UMRAH_DOC_TYPES, UMRAH_DOC_TYPE_LABELS, UMRAH_STAGE_LABELS, type UmrahStage } from "../stages";
import { FileField } from "@/components/ui/upload";

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
        <FileField id="docFile" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
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

export function CancelBookingButton({
  bookingId,
  paid,
  currency,
}: {
  bookingId: string;
  paid: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(cancelUmrahBooking, null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);
  useRefreshOnSuccess(state, () => setOpen(false));

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="size-8 text-destructive hover:text-destructive"
        aria-label="Cancel booking"
        onClick={() => setOpen(true)}
      >
        <Ban className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="bookingId" value={bookingId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason</Label>
              <Textarea id="cancel-reason" name="reason" rows={2} maxLength={500} required />
            </div>
            {paid > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="cancel-refund">
                  Refund ({currency}, paid {paid.toFixed(2)})
                </Label>
                <Input
                  id="cancel-refund"
                  name="refundAmount"
                  type="number"
                  min={0}
                  max={paid}
                  step="0.01"
                  defaultValue={paid.toFixed(2)}
                  required
                />
              </div>
            ) : null}
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep booking
              </Button>
              <SubmitButton variant="destructive" pendingText="Cancelling…">
                Cancel booking
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ReviewDocumentButtons({ documentId }: { documentId: string }) {
  const [acceptState, acceptAction] = useActionState(reviewUmrahDocument, null);
  const [rejectState, rejectAction] = useActionState(reviewUmrahDocument, null);
  const [open, setOpen] = useState(false);
  useRefreshOnSuccess(acceptState);
  useRefreshOnSuccess(rejectState, () => setOpen(false));
  const error = acceptState?.error;

  return (
    <>
      <form action={acceptAction}>
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="decision" value="accepted" />
        <SubmitButton size="icon" variant="outline" className="size-8" aria-label="Accept document" pendingText="">
          <Check className="size-3.5" />
        </SubmitButton>
      </form>
      <Button
        size="icon"
        variant="outline"
        className="size-8 text-destructive hover:text-destructive"
        aria-label="Reject document"
        onClick={() => setOpen(true)}
      >
        <X className="size-3.5" />
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={rejectAction} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="decision" value="rejected" />
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this document?</AlertDialogTitle>
            </AlertDialogHeader>
            {rejectState?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{rejectState.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`reject-note-${documentId}`}>Reason</Label>
              <Textarea id={`reject-note-${documentId}`} name="note" rows={2} maxLength={500} required />
            </div>
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
    </>
  );
}

export type SegmentRow = {
  id: string;
  kind: string;
  title: string;
  provider: string | null;
  reference: string | null;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
  notes: string | null;
};

/** Segment times are wall clock, stored UTC-tagged, so the UTC value goes back into the input. */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export function SegmentDialog({ bookingId, segment }: { bookingId: string; segment?: SegmentRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveUmrahSegment, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);
  useRefreshOnSuccess(state, () => setOpen(false));
  const key = segment?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {segment ? (
        <DialogTrigger render={<Button size="icon" variant="outline" className="size-8" aria-label={`Edit ${segment.title}`} />}>
          <Pencil className="size-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
          <Plus className="size-3.5" /> Add
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{segment ? "Edit travel detail" : "Add travel detail"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="segmentId" value={segment?.id ?? ""} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`seg-kind-${key}`}>Type</Label>
              <select id={`seg-kind-${key}`} name="kind" className={selectClass} defaultValue={segment?.kind ?? "flight"}>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="transfer">Transfer</option>
                <option value="train">Train</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`seg-city-${key}`}>City</Label>
              <select id={`seg-city-${key}`} name="city" className={selectClass} defaultValue={segment?.city ?? ""}>
                <option value="">—</option>
                <option value="makkah">Makkah</option>
                <option value="madinah">Madinah</option>
                <option value="jeddah">Jeddah</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`seg-title-${key}`}>Title</Label>
            <Input
              id={`seg-title-${key}`}
              name="title"
              maxLength={120}
              placeholder="e.g. Saudia SV 551 MGQ–JED"
              defaultValue={segment?.title ?? ""}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`seg-provider-${key}`}>Provider</Label>
              <Input id={`seg-provider-${key}`} name="provider" maxLength={80} defaultValue={segment?.provider ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`seg-ref-${key}`}>Reference</Label>
              <Input id={`seg-ref-${key}`} name="reference" maxLength={60} defaultValue={segment?.reference ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`seg-start-${key}`}>Starts</Label>
              <Input id={`seg-start-${key}`} name="startsAt" type="datetime-local" defaultValue={toLocalInput(segment?.starts_at ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`seg-end-${key}`}>Ends</Label>
              <Input id={`seg-end-${key}`} name="endsAt" type="datetime-local" defaultValue={toLocalInput(segment?.ends_at ?? null)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`seg-notes-${key}`}>Notes</Label>
            <Textarea id={`seg-notes-${key}`} name="notes" rows={2} maxLength={500} defaultValue={segment?.notes ?? ""} />
          </div>
          <SubmitButton pendingText="Saving…">{segment ? "Save" : "Add"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSegmentButton({ segmentId, title }: { segmentId: string; title: string }) {
  const [state, formAction] = useActionState(deleteUmrahSegment, null);
  const [open, setOpen] = useState(false);
  useRefreshOnSuccess(state, () => setOpen(false));

  return (
    <>
      <Button size="icon" variant="outline" className="size-8" aria-label={`Delete ${title}`} onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="segmentId" value={segmentId} />
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
