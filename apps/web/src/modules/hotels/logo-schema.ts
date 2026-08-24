/**
 * Shared between the client-side pre-check (HotelLogoUploader) and the
 * server-side write (logo-storage.ts) — a size/type mismatch between the two
 * is exactly how a too-large file used to reach the server at all: nothing
 * stopped the browser from submitting it, so it hit Next's serverActions
 * bodySizeLimit (6MB) and crashed with a raw framework error instead of the
 * "Image must be 2MB or smaller" message this module already had server-side.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export function checkLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) return "Only JPG, PNG, WebP, or SVG images are accepted.";
  if (file.size > MAX_LOGO_BYTES) return "Image must be 2MB or smaller.";
  return null;
}
