"use client";

import { useActionState } from "react";
import { AlertCircle, Building2, CloudUpload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { uploadOrgLogo, removeOrgLogo, type ActionState } from "../actions";
import { partnerLogoUrl } from "../logo-url";
import type { ApplicationKind } from "../config";

/** Optional branding logo on the Business Details step — agency/hotel_partner/venue_partner only, visible to admins reviewing the application. */
export function LogoUploadField({
  kind,
  applicationId,
  logoPath,
}: {
  kind: ApplicationKind;
  applicationId: string;
  logoPath: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadOrgLogo, null);
  const logoUrl = partnerLogoUrl(logoPath);

  return (
    <div className="flex items-start gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Organization logo" className="size-full object-contain" />
        ) : (
          <Building2 className="size-6 text-muted-foreground" />
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
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="applicationId" value={applicationId} />
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
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
                }}
              />
              <CloudUpload className="size-4" />
              {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo (optional)"}
            </label>
          </form>
          {logoUrl ? (
            <form action={removeOrgLogo}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="applicationId" value={applicationId} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Remove
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
