import { createClient } from "@/lib/supabase/server";
import { MAX_LOGO_BYTES, ALLOWED_LOGO_TYPES } from "./logo-schema";

type UploadResult = { error: string | null };

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/**
 * Shared upload/remove mechanics for a hotel's single logo file — auth lives
 * with each caller (requirePlatformAdmin, or requireHotelPhotoAccess from
 * the partner portal), not in here. Same split as property-gallery-actions.ts.
 */
export async function uploadHotelLogo(hotelId: string, file: File): Promise<UploadResult> {
  if (file.size === 0) return { error: "Choose an image to upload." };
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, WebP, or SVG images are accepted." };
  }
  if (file.size > MAX_LOGO_BYTES) return { error: "Image must be 2MB or smaller." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("hotels").select("logo_path").eq("id", hotelId).maybeSingle();
  const previousPath = existing?.logo_path ?? null;

  const storagePath = `${hotelId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("hotel-logos")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("hotels").update({ logo_path: storagePath }).eq("id", hotelId);
  if (error) {
    await supabase.storage.from("hotel-logos").remove([storagePath]);
    return { error: error.message };
  }

  if (previousPath) {
    await supabase.storage.from("hotel-logos").remove([previousPath]);
  }

  return { error: null };
}

export async function removeHotelLogo(hotelId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("hotels").select("logo_path").eq("id", hotelId).maybeSingle();
  const previousPath = existing?.logo_path ?? null;
  if (!previousPath) return;

  await supabase.from("hotels").update({ logo_path: null }).eq("id", hotelId);
  await supabase.storage.from("hotel-logos").remove([previousPath]);
}
