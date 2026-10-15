"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { FileField } from "@/components/ui/upload";
import { resubmitRejectedDocument } from "@/modules/partner-applications/actions";
import { checkUploadFile } from "@/modules/partner-applications/schemas";
import type { ApplicationKind } from "@/modules/partner-applications/config";

/** Only rendered while a document's review status is 'rejected' — once the
 * upload succeeds the status flips to 'pending' and the parent stops
 * rendering this, so the success toast is fired from the pending->success
 * transition rather than held as client state here. */
export function ResubmitDocumentForm({
  kind,
  applicationId,
  docKey,
}: {
  kind: ApplicationKind;
  applicationId: string;
  docKey: string;
}) {
  const [state, formAction, isPending] = useActionState(resubmitRejectedDocument, null);
  const [hasFile, setHasFile] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      toast.success("Document submitted for review.");
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="docKey" value={docKey} />
      <FileField
        name="file"
        accept="application/pdf"
        required
        validate={checkUploadFile}
        onFilesChange={(files) => setHasFile(files.length > 0)}
      />

      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      <SubmitButton size="sm" pendingText="Uploading…" className="gap-1.5" disabled={!hasFile}>
        <UploadCloud className="size-3.5" /> Upload replacement
      </SubmitButton>
    </form>
  );
}
