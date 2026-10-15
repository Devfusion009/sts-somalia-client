"use client";

import { LogoUploader } from "@/components/ui/upload";
import { uploadAgencyLogoAction, removeAgencyLogoAction } from "@/modules/agencies/settings-actions";

export function AgencyLogoUploader({ logoUrl }: { logoUrl: string | null }) {
  return (
    <LogoUploader
      logoUrl={logoUrl}
      alt="Agency logo"
      action={uploadAgencyLogoAction}
      removeAction={removeAgencyLogoAction}
    />
  );
}
