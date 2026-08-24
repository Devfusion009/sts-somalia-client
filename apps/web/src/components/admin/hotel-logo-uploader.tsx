"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Building2, CloudUpload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { checkLogoFile } from "@/modules/hotels/logo-schema";
import type { ActionState } from "@/lib/auth/actions";

export function HotelLogoUploader({
  hotelId,
  logoUrl,
  uploadAction,
  removeAction,
}: {
  hotelId: string;
  logoUrl: string | null;
  uploadAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(uploadAction, null);
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <div className="flex items-start gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Hotel logo" className="size-full object-contain" />
        ) : (
          <Building2 className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        {fileError ?? state?.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{fileError ?? state?.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <form action={formAction}>
            <input type="hidden" name="id" value={hotelId} />
            <label
              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                pending
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-input hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Pre-checked here because an oversized file is rejected by
                  // Next's Server Actions body limit before the action's own
                  // size check runs — that surfaces as a raw framework crash
                  // instead of this message.
                  const problem = checkLogoFile(file);
                  setFileError(problem);
                  if (problem) {
                    e.target.value = "";
                    return;
                  }
                  e.currentTarget.form?.requestSubmit();
                }}
              />
              <CloudUpload className="size-4" />
              {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </label>
          </form>
          {logoUrl ? (
            <form action={removeAction}>
              <input type="hidden" name="id" value={hotelId} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Remove
              </Button>
            </form>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or SVG. Up to 2MB.</p>
      </div>
    </div>
  );
}
