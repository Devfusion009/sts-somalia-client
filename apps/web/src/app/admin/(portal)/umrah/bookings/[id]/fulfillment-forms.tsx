"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { trpc } from "@/lib/trpc/react";
import { trpcErrorMessage } from "@/lib/trpc/errors";

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
      <Field>
        <FieldLabel htmlFor="stage">Move to</FieldLabel>
        <select id="stage" name="stage" className={NATIVE_SELECT_CLASS} defaultValue={nextStages[0]} required>
          {nextStages.map((s) => (
            <option key={s} value={s}>
              {UMRAH_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="stage-note">Note</FieldLabel>
        <Textarea id="stage-note" name="note" rows={2} maxLength={500} placeholder="Optional" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Updating…">Update stage</SubmitButton>
      </div>
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
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="docType">Type</FieldLabel>
          <select id="docType" name="docType" className={NATIVE_SELECT_CLASS} defaultValue="visa" required>
            {UMRAH_DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {UMRAH_DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="pilgrimId">Pilgrim</FieldLabel>
          <select id="pilgrimId" name="pilgrimId" className={NATIVE_SELECT_CLASS} defaultValue="">
            <option value="">Whole booking</option>
            {pilgrims.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="docTitle">Title</FieldLabel>
        <Input id="docTitle" name="title" maxLength={120} required />
      </Field>
      <Field>
        <FieldLabel htmlFor="docFile">File</FieldLabel>
        <FileField id="docFile" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Uploading…">
          <Upload aria-hidden="true" /> Upload
        </SubmitButton>
      </div>
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
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${title}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="documentId" value={documentId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? (
              <p role="alert" className="my-2 text-xs text-destructive">
                {state.error}
              </p>
            ) : null}
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
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const cancel = trpc.umrah.admin.bookings.cancel.useMutation({
    onSuccess() {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Cancel booking"
        title="Cancel booking"
        onClick={() => setOpen(true)}
      >
        <Ban />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (cancel.isPending) return;
            const data = new FormData(event.currentTarget);
            const amount = String(data.get("refundAmount") ?? "").trim();
            cancel.mutate({ bookingId, reason: String(data.get("reason") ?? "").trim(), refundAmount: amount ? Number(amount) : undefined });
          }} className="space-y-4">
            <input type="hidden" name="bookingId" value={bookingId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            </AlertDialogHeader>
            {cancel.error ? (
              <Alert variant="destructive">
                <AlertDescription>{trpcErrorMessage(cancel.error, "The booking could not be cancelled.")}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
              <Textarea id="cancel-reason" name="reason" rows={2} maxLength={500} required />
            </Field>
            {paid > 0 ? (
              <Field>
                <FieldLabel htmlFor="cancel-refund">
                  Refund ({currency}, paid {paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </FieldLabel>
                <Input
                  id="cancel-refund"
                  name="refundAmount"
                  type="number"
                  min={0}
                  max={paid}
                  step="0.01"
                  defaultValue={paid.toFixed(2)}
                  className="tabular-nums"
                  required
                />
              </Field>
            ) : null}
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep booking
              </Button>
              <Button type="submit" variant="destructive" disabled={cancel.isPending} loading={cancel.isPending}>
                {cancel.isPending ? "Cancelling…" : "Cancel booking"}
              </Button>
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
        <SubmitButton size="icon" variant="ghost" className="text-primary hover:text-primary" aria-label="Accept document" title="Accept" pendingText="">
          <Check />
        </SubmitButton>
      </form>
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        aria-label="Reject document"
        title="Reject"
        onClick={() => setOpen(true)}
      >
        <X />
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
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
            <Field>
              <FieldLabel htmlFor={`reject-note-${documentId}`}>Reason</FieldLabel>
              <Textarea id={`reject-note-${documentId}`} name="note" rows={2} maxLength={500} required />
            </Field>
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
        <DialogTrigger render={<Button size="icon" variant="ghost" aria-label={`Edit ${segment.title}`} title="Edit" />}>
          <Pencil />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <Plus aria-hidden="true" /> Add
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{segment ? "Edit travel detail" : "Add travel detail"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="segmentId" value={segment?.id ?? ""} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor={`seg-kind-${key}`}>Type</FieldLabel>
              <select id={`seg-kind-${key}`} name="kind" className={NATIVE_SELECT_CLASS} defaultValue={segment?.kind ?? "flight"}>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="transfer">Transfer</option>
                <option value="train">Train</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`seg-city-${key}`}>City</FieldLabel>
              <select id={`seg-city-${key}`} name="city" className={NATIVE_SELECT_CLASS} defaultValue={segment?.city ?? ""}>
                <option value="">—</option>
                <option value="makkah">Makkah</option>
                <option value="madinah">Madinah</option>
                <option value="jeddah">Jeddah</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`seg-title-${key}`}>Title</FieldLabel>
            <Input
              id={`seg-title-${key}`}
              name="title"
              maxLength={120}
              placeholder="e.g. Saudia SV 551 MGQ–JED"
              defaultValue={segment?.title ?? ""}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor={`seg-provider-${key}`}>Provider</FieldLabel>
              <Input id={`seg-provider-${key}`} name="provider" maxLength={80} defaultValue={segment?.provider ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`seg-ref-${key}`}>Reference</FieldLabel>
              <Input id={`seg-ref-${key}`} name="reference" maxLength={60} defaultValue={segment?.reference ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`seg-start-${key}`}>Starts</FieldLabel>
              <Input id={`seg-start-${key}`} name="startsAt" type="datetime-local" defaultValue={toLocalInput(segment?.starts_at ?? null)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`seg-end-${key}`}>Ends</FieldLabel>
              <Input id={`seg-end-${key}`} name="endsAt" type="datetime-local" defaultValue={toLocalInput(segment?.ends_at ?? null)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`seg-notes-${key}`}>Notes</FieldLabel>
            <Textarea id={`seg-notes-${key}`} name="notes" rows={2} maxLength={500} defaultValue={segment?.notes ?? ""} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{segment ? "Save changes" : "Add"}</SubmitButton>
          </div>
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
      <Button
        size="icon"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${title}`}
        title="Delete"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="segmentId" value={segmentId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? (
              <p role="alert" className="my-2 text-xs text-destructive">
                {state.error}
              </p>
            ) : null}
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
