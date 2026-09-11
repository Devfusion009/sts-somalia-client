"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { replaceRejectedDocument } from "@/modules/visa/actions";

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
        onChange={() => formRef.current?.requestSubmit()}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        <Upload className="size-3.5" />
        {pending ? "Uploading…" : "Replace"}
      </Button>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
