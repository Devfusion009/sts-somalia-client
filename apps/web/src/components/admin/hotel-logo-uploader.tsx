"use client";

import { LogoUploader } from "@/components/ui/upload";
import { checkLogoFile } from "@/modules/hotels/logo-schema";
import type { ActionState } from "@/lib/auth/actions";

/**
 * The file is pre-checked client-side because an oversized logo is rejected
 * by Next's Server Actions body limit before the action's own size check
 * runs — that surfaces as a raw framework crash instead of a message.
 */
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
  return (
    <LogoUploader
      logoUrl={logoUrl}
      alt="Hotel logo"
      action={uploadAction}
      removeAction={removeAction}
      fields={{ id: hotelId }}
      validate={checkLogoFile}
    />
  );
}
