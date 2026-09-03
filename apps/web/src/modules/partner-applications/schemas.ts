import { z } from "zod";

/**
 * "+<dial code><6-10 digit local number>", produced by PhoneField
 * (components/phone-field.tsx). Lives here, not in actions.ts, because a
 * "use server" file may only export async functions — a Zod schema export
 * breaks the build the moment a second module needs to import it too.
 */
export const phoneSchema = z.string().regex(/^\+\d{1,4}\d{6,10}$/, "Enter a valid phone number.");

/**
 * Upload limits, shared by the server actions that enforce them and the file
 * inputs that must pre-check against them. The pre-check is not a nicety:
 * Next rejects a Server Action request whose body exceeds
 * serverActions.bodySizeLimit (6mb, next.config.ts) before the action runs at
 * all, so an oversized file never reaches the server-side size check and
 * surfaces as an unhandled 500 instead of a readable message. Keep this
 * comfortably under that limit.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf"];
export const UPLOAD_SIZE_ERROR = "File must be 5MB or smaller.";
export const UPLOAD_TYPE_ERROR = "Only PDF files are accepted.";

/** Shared by every client-side file input that posts to a Server Action. */
export function checkUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return UPLOAD_TYPE_ERROR;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_SIZE_ERROR;
  return null;
}

/** A logo is a branding image, not a compliance document — its own (looser, image-only) limits. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const LOGO_SIZE_ERROR = "Logo must be 2MB or smaller.";
export const LOGO_TYPE_ERROR = "Only PNG, JPG, WebP, or SVG images are accepted.";

export function checkLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) return LOGO_TYPE_ERROR;
  if (file.size > MAX_LOGO_BYTES) return LOGO_SIZE_ERROR;
  return null;
}
