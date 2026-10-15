"use client";

import { LogoUploader } from "@/components/ui/upload";
import { uploadOrgLogo, removeOrgLogo } from "../actions";
import { partnerLogoUrl } from "../logo-url";
import { checkLogoFile } from "../schemas";
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
  return (
    <LogoUploader
      logoUrl={partnerLogoUrl(logoPath)}
      alt="Organization logo"
      action={uploadOrgLogo}
      removeAction={removeOrgLogo}
      fields={{ kind, applicationId }}
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      validate={checkLogoFile}
    />
  );
}
