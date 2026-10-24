"use client";

import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadRequestedDocument } from "@/modules/visa/actions";
import { UploadStatus } from "@/components/ui/upload";

/** Upload control for one admin-requested additional document. */
export function RequestUpload({
  requestId,
  applicationId,
}: {
  requestId: string;
  applicationId: string;
}) {
  const [state, formAction, pending] = useActionState(uploadRequestedDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="sr-only"
        onChange={(e) => {
          setChosen(e.target.files?.[0] ?? null);
          formRef.current?.requestSubmit();
        }}
      />
      <Button
        type="button"
        variant="outline"
        loading={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? null : <Upload data-icon="inline-start" aria-hidden="true" />}
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <UploadStatus file={chosen} pending={pending} error={state?.error} className="w-full min-w-60" />
    </form>
  );
}
