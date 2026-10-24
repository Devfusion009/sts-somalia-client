"use client";

import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { replaceRejectedDocument } from "@/modules/visa/actions";
import { UploadStatus } from "@/components/ui/upload";

/** Re-upload control for one document STS rejected. */
export function ReplaceUpload({
  documentId,
  applicationId,
}: {
  documentId: string;
  applicationId: string;
}) {
  const [state, formAction, pending] = useActionState(replaceRejectedDocument, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="documentId" value={documentId} />
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
        {pending ? "Uploading…" : "Replace"}
      </Button>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <UploadStatus file={chosen} pending={pending} error={state?.error} className="w-full min-w-60" />
    </form>
  );
}
