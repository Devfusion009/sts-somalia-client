"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileField } from "@/components/ui/upload";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  deletePilgrimDocument,
  uploadPilgrimDocument,
  type PilgrimActionState,
} from "@/modules/umrah/pilgrim-actions";
import { HAND_IN_LABEL, HAND_IN_TYPES, REVIEW_STATUS_LABEL, type HandInType } from "@/modules/umrah/readiness";

export type HandedInDocument = {
  id: string;
  pilgrim_id: string | null;
  doc_type: string;
  title: string;
  review_status: string;
  review_note: string | null;
  url: string | null;
};

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const REVIEW_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  accepted: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

function useRefreshOnSuccess(state: PilgrimActionState, onSuccess?: () => void) {
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

function UploadDialog({ bookingId, pilgrims }: { bookingId: string; pilgrims: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<PilgrimActionState, FormData>(uploadPilgrimDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state, () => {
    formRef.current?.reset();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
        <Upload className="size-3.5" /> Upload
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="handin-pilgrim">Pilgrim</Label>
              <select id="handin-pilgrim" name="pilgrimId" className={selectClass} defaultValue={pilgrims[0]?.id} required>
                {pilgrims.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="handin-type">Type</Label>
              <select id="handin-type" name="docType" className={selectClass} defaultValue="passport_copy" required>
                {HAND_IN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {HAND_IN_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handin-file">File</Label>
            <FileField id="handin-file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
          </div>
          <SubmitButton pendingText="Uploading…">
            <Upload /> Upload
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ documentId, title }: { documentId: string; title: string }) {
  const [state, formAction] = useActionState<PilgrimActionState, FormData>(deletePilgrimDocument, null);
  useRefreshOnSuccess(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton size="icon" variant="outline" className="size-8" aria-label={`Remove ${title}`} pendingText="">
        <Trash2 className="size-3.5" />
      </SubmitButton>
      {state?.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

/**
 * Passport copies, photos and certificates the traveller hands in for each
 * pilgrim, with the staff review status. Upload is offered while the
 * booking is open for changes; the storage and table policies enforce it.
 */
export function PilgrimDocuments({
  bookingId,
  pilgrims,
  documents,
  canUpload,
}: {
  bookingId: string;
  pilgrims: { id: string; full_name: string }[];
  documents: HandedInDocument[];
  canUpload: boolean;
}) {
  const names = new Map(pilgrims.map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-3">
      {documents.length > 0 ? (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {HAND_IN_LABEL[doc.doc_type as HandInType] ?? doc.doc_type}
                  {doc.pilgrim_id ? ` · ${names.get(doc.pilgrim_id) ?? ""}` : ""}
                </p>
                {doc.review_status === "rejected" && doc.review_note ? (
                  <p className="text-xs text-destructive">{doc.review_note}</p>
                ) : null}
              </div>
              <Badge className={cn("border-transparent", REVIEW_STYLES[doc.review_status] ?? "bg-muted text-muted-foreground")}>
                {REVIEW_STATUS_LABEL[doc.review_status] ?? doc.review_status}
              </Badge>
              {doc.url ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  aria-label={`Download ${doc.title}`}
                  nativeButton={false}
                  render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
                >
                  <Download className="size-3.5" />
                </Button>
              ) : null}
              {doc.review_status === "pending" && canUpload ? <DeleteButton documentId={doc.id} title={doc.title} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canUpload && pilgrims.length > 0 ? <UploadDialog bookingId={bookingId} pilgrims={pilgrims} /> : null}
    </div>
  );
}
