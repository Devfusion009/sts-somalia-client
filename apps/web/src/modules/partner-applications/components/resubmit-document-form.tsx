"use client";

import { useActionState, useRef, useState, useEffect, type DragEvent } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { resubmitRejectedDocument } from "@/modules/partner-applications/actions";
import { checkUploadFile } from "@/modules/partner-applications/schemas";
import type { ApplicationKind } from "@/modules/partner-applications/config";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      toast.success("Document submitted for review.");
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  function applyFile(candidate: File | null) {
    if (!candidate) {
      setFile(null);
      setFileError(null);
      return;
    }
    const problem = checkUploadFile(candidate);
    setFileError(problem);
    setFile(problem ? null : candidate);
  }

  function clearFile() {
    setFile(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped && inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(dropped);
      inputRef.current.files = transfer.files;
    }
    applyFile(dropped);
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="docKey" value={docKey} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,application/pdf"
        required
        className="sr-only"
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove selected file"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <UploadCloud className="size-5 text-muted-foreground" />
          <p className="text-xs font-medium">Drag and drop, or click to browse</p>
          <p className="text-[11px] text-muted-foreground">JPG, PNG, or PDF — up to 5MB</p>
        </div>
      )}

      {fileError ?? state?.error ? <p className="text-xs text-destructive">{fileError ?? state?.error}</p> : null}

      <SubmitButton size="sm" pendingText="Uploading…" className="gap-1.5" disabled={!file}>
        <UploadCloud className="size-3.5" /> Upload replacement
      </SubmitButton>
    </form>
  );
}
