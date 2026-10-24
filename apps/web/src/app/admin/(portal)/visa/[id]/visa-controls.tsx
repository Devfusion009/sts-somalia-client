"use client";

import { useActionState, useRef, useState } from "react";
import { format } from "date-fns";
import { FilePlus2, RefreshCw, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import {
  adminRequestDocument,
  adminUploadResultDocument,
  adminSubmitToPartner,
  adminSyncPartnerStatus,
} from "@/modules/visa/admin-actions";
import { UploadStatus } from "@/components/ui/upload";

export function RequestDocumentDialog({
  applicationId,
  trigger = "outline",
}: {
  applicationId: string;
  trigger?: "outline" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(adminRequestDocument, null);

  // Derived during render (not an effect) per React's guidance for reacting
  // to a state change — refs can't be read/written during render.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={trigger} />}>
        <FilePlus2 data-icon="inline-start" /> Request document
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <DialogHeader>
            <DialogTitle>Request a document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="req-title">Document name</FieldLabel>
              <Input id="req-title" name="title" placeholder="e.g. Bank Statement (Last 3 Months)" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="req-desc">Instructions</FieldLabel>
              <Textarea id="req-desc" name="description" rows={2} placeholder="Optional" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Requirement</FieldLabel>
                <Select
                  name="requirement"
                  defaultValue="required"
                  items={[
                    { value: "required", label: "Required" },
                    { value: "optional", label: "Optional" },
                  ]}
                >
                  <SelectTrigger className="w-full" aria-label="Requirement">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="req-due">Due by</FieldLabel>
                <Input id="req-due" name="dueDate" type="date" min={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>
            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Sending…">Send request</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Upload the final visa document that the customer downloads. */
export function ResultUpload({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState(adminUploadResultDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-1.5">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => {
          setChosen(e.target.files?.[0] ?? null);
          formRef.current?.requestSubmit();
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        loading={pending}
        className="w-full"
      >
        {pending ? null : <Upload data-icon="inline-start" />}
        {pending ? "Uploading…" : "Upload visa document"}
      </Button>
      <UploadStatus file={chosen} pending={pending} error={state?.error} className="w-full min-w-60" />
    </form>
  );
}

/** Hand the application to the visa type's configured processing partner, and re-sync its status. */
export function PartnerControl({
  applicationId,
  partnerName,
  partnerAvailable,
  partnerRef,
  partnerStatus,
  partnerLastSyncedAt,
}: {
  applicationId: string;
  partnerName: string;
  /** False when the provider has no active credentials — the button would only fail if clicked. */
  partnerAvailable: boolean;
  partnerRef: string | null;
  partnerStatus: string | null;
  partnerLastSyncedAt: string | null;
}) {
  const [state, submitAction] = useActionState(adminSubmitToPartner, null);

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">Partner</dt>
          <dd className="mt-0.5 font-medium">{partnerName}</dd>
        </div>
        {partnerRef ? (
          <>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Reference</dt>
              <dd className="mt-0.5 truncate font-mono text-xs">{partnerRef}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-0.5 font-medium capitalize">{partnerStatus?.replace(/_/g, " ") ?? "—"}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Last synced</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {partnerLastSyncedAt ? format(new Date(partnerLastSyncedAt), "d MMM yyyy, HH:mm") : "Never"}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      {partnerRef ? (
        <form action={adminSyncPartnerStatus}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <SubmitButton variant="outline" className="w-full" pendingText="Syncing…">
            <RefreshCw data-icon="inline-start" /> Sync status
          </SubmitButton>
        </form>
      ) : !partnerAvailable ? (
        <Alert variant="destructive">
          <AlertDescription>{partnerName} has no active credentials.</AlertDescription>
        </Alert>
      ) : (
        <form action={submitAction} className="space-y-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <SubmitButton pendingText="Submitting…" className="w-full">
            <Send data-icon="inline-start" /> Submit to partner
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
