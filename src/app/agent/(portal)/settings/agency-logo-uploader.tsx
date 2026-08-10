"use client";

import { useActionState } from "react";
import { AlertCircle, Building2, CloudUpload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { uploadAgencyLogoAction, removeAgencyLogoAction } from "@/modules/agencies/settings-actions";

export function AgencyLogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadAgencyLogoAction, null);

  return (
    <div className="flex items-start gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Agency logo" className="size-full object-contain" />
        ) : (
          <Building2 className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        {state?.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <form action={formAction}>
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
                  if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
                }}
              />
              <CloudUpload className="size-4" />
              {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </label>
          </form>
          {logoUrl ? (
            <form action={removeAgencyLogoAction}>
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
