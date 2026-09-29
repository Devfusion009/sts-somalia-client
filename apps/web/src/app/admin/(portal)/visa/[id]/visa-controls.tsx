"use client";

import { useActionState, useRef, useState } from "react";
import { FilePlus2, RefreshCw, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <DialogTrigger render={<Button variant={trigger} size="sm" />}>
        <FilePlus2 /> Request document
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <DialogHeader>
            <DialogTitle>Request a document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="req-title">Document name</Label>
              <Input id="req-title" name="title" placeholder="e.g. Bank Statement (Last 3 Months)" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-desc">Instructions</Label>
              <Textarea id="req-desc" name="description" rows={2} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Requirement</Label>
                <Select
                  name="requirement"
                  defaultValue="required"
                  items={[
                    { value: "required", label: "Required" },
                    { value: "optional", label: "Optional" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-due">Due by</Label>
                <Input id="req-due" name="dueDate" type="date" min={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
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

  return (
    <form ref={formRef} action={formAction} className="space-y-1.5">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="w-full gap-2"
      >
        <Upload className="size-4" />
        {pending ? "Uploading…" : "Upload visa document"}
      </Button>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
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
      <dl className="space-y-3">
        <div>
          <dt className="text-xs text-muted-foreground">Partner</dt>
          <dd className="font-medium">{partnerName}</dd>
        </div>
        {partnerRef ? (
          <>
            <div>
              <dt className="text-xs text-muted-foreground">Partner reference</dt>
              <dd className="font-mono text-xs">{partnerRef}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Partner status</dt>
              <dd className="font-medium capitalize">{partnerStatus?.replace(/_/g, " ") ?? "—"}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {partnerRef ? (
        <>
          <p className="text-xs text-muted-foreground">
            {partnerLastSyncedAt
              ? `Last synced ${new Date(partnerLastSyncedAt).toLocaleString()}`
              : "Not yet synced."}
          </p>
          <form action={adminSyncPartnerStatus}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <Button type="submit" variant="outline" size="sm" className="w-full gap-1.5">
              <RefreshCw className="size-3.5" /> Sync status
            </Button>
          </form>
        </>
      ) : !partnerAvailable ? (
        <Alert variant="destructive">
          <AlertDescription>{partnerName} has no active credentials — configure it under Integrations.</AlertDescription>
        </Alert>
      ) : (
        <form action={submitAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          {state?.error ? (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <SubmitButton pendingText="Submitting…" className="w-full gap-1.5">
            <Send className="size-3.5" /> Submit to partner
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
