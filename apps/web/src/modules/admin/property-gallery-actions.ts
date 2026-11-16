"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { TARGETS } from "@/modules/admin/gallery-targets";
import type { ActionState } from "@/lib/auth/actions";

/**
 * One generic gallery store behind three thin, admin-gated wrappers (hotel /
 * room / venue) — same "upload → prepend path to a jsonb array → index 0 is
 * cover" shape as modules/umrah/admin-actions.ts's gallery actions, the only
 * other multi-file gallery in this codebase. Kept generic here (rather than
 * copy-pasted three times) because the three targets are otherwise identical;
 * each vertical still gets its own small exported function so call sites read
 * as plain server actions, not a config object threaded through JSX.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export type GalleryTarget = {
  table: "hotels" | "hotel_rooms" | "event_venues";
  bucket: "hotel-images" | "venue-images";
  pathPrefix: (id: string) => string;
  revalidate: (id: string) => void | Promise<void>;
};

async function getImages(supabase: Awaited<ReturnType<typeof createClient>>, target: GalleryTarget, id: string) {
  const { data } = await supabase.from(target.table).select("images").eq("id", id).maybeSingle();
  const images = data?.images;
  return Array.isArray(images) ? images.filter((p): p is string => typeof p === "string") : [];
}

/**
 * Auth lives with each caller (requirePlatformAdmin below, or a
 * hotelId/permission check from the partner portal — see
 * hotel-gallery-actions.ts), not in here: this is the shared upload/remove/
 * cover mechanics only, so the two callers can enforce completely different
 * rules without duplicating storage + rollback logic.
 */
/** Upload result; `upload` is set by the "sign" phase only. */
export type GalleryUploadState = ActionState & { upload?: { path: string; signedUrl: string } };

/**
 * Two-phase direct upload, used by GalleryManager so the browser can stream
 * each file straight to Storage and report real byte progress:
 *   1. phase=sign   — validates name/type/size and returns a signed upload
 *                     URL for a fresh path under the record's prefix. Signing
 *                     runs under the caller's own session, so the bucket's
 *                     INSERT policy is enforced here.
 *   2. phase=commit — after the browser PUT succeeds, appends the path to the
 *                     record's images (RLS on the row), or deletes the object
 *                     if that write fails.
 * Every caller-specific wrapper forwards the same FormData here, so its
 * authorization runs before each phase. Without a phase this is the original
 * single-request upload (room creation still bundles files that way).
 */
async function signUpload(target: GalleryTarget, id: string, formData: FormData): Promise<GalleryUploadState> {
  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "");
  const size = Number(formData.get("size") ?? 0);
  if (!name) return { error: "Unknown file." };
  if (!ALLOWED_TYPES.includes(type)) return { error: "Only JPG, PNG, WebP, MP4 or WebM files are accepted." };
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) return { error: "Files must be 20 MB or smaller." };

  const suffix = crypto.randomUUID().slice(0, 8);
  const path = `${target.pathPrefix(id)}/${Date.now()}-${suffix}-${sanitizeFilename(name)}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(target.bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Upload could not be started." };
  return { error: null, upload: { path: data.path, signedUrl: data.signedUrl } };
}

async function commitUpload(target: GalleryTarget, id: string, formData: FormData): Promise<GalleryUploadState> {
  const path = String(formData.get("path") ?? "");
  const prefix = `${target.pathPrefix(id)}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.slice(prefix.length).includes("/")) {
    return { error: "Unknown file." };
  }

  const supabase = await createClient();
  const { data: stored } = await supabase.storage.from(target.bucket).exists(path);
  if (!stored) return { error: "The file didn't finish uploading." };

  const existing = await getImages(supabase, target, id);
  if (existing.includes(path)) return { error: null };

  const { error } = await supabase
    .from(target.table)
    .update({ images: [...existing, path] })
    .eq("id", id);
  if (error) {
    await supabase.storage.from(target.bucket).remove([path]);
    return { error: error.message };
  }

  await target.revalidate(id);
  return { error: null };
}

export async function uploadImages(target: GalleryTarget, formData: FormData): Promise<GalleryUploadState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Unknown record." };

  const phase = formData.get("phase");
  if (phase === "sign") return signUpload(target, id, formData);
  if (phase === "commit") return commitUpload(target, id, formData);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one file." };
  if (files.length > 10) return { error: "Upload at most 10 files at a time." };

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: `${file.name}: only JPG, PNG, WebP images or MP4/WebM video are accepted.` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { error: `${file.name}: each file must be 20MB or smaller.` };
    }
  }

  const supabase = await createClient();
  const existing = await getImages(supabase, target, id);

  const uploaded: string[] = [];
  for (const file of files) {
    const path = `${target.pathPrefix(id)}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(target.bucket)
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      if (uploaded.length > 0) await supabase.storage.from(target.bucket).remove(uploaded);
      return { error: uploadError.message };
    }
    uploaded.push(path);
  }

  const { error } = await supabase
    .from(target.table)
    .update({ images: [...existing, ...uploaded] })
    .eq("id", id);
  if (error) {
    await supabase.storage.from(target.bucket).remove(uploaded);
    return { error: error.message };
  }

  await target.revalidate(id);
  return { error: null };
}

export async function removeImage(target: GalleryTarget, formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!id || !path) return;

  const supabase = await createClient();
  const existing = await getImages(supabase, target, id);
  const next = existing.filter((p) => p !== path);

  await supabase.from(target.table).update({ images: next }).eq("id", id);
  await supabase.storage.from(target.bucket).remove([path]);
  await target.revalidate(id);
}

export async function setCoverImage(target: GalleryTarget, formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!id || !path) return;

  const supabase = await createClient();
  const existing = await getImages(supabase, target, id);
  if (!existing.includes(path)) return;
  const next = [path, ...existing.filter((p) => p !== path)];

  await supabase.from(target.table).update({ images: next }).eq("id", id);
  await target.revalidate(id);
}

export async function uploadHotelImages(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  await requirePlatformAdmin();
  return uploadImages(TARGETS.hotel, formData);
}
export async function removeHotelImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return removeImage(TARGETS.hotel, formData);
}
export async function setHotelCoverImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return setCoverImage(TARGETS.hotel, formData);
}

export async function uploadRoomImages(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  await requirePlatformAdmin();
  return uploadImages(TARGETS.room, formData);
}
export async function removeRoomImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return removeImage(TARGETS.room, formData);
}
export async function setRoomCoverImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return setCoverImage(TARGETS.room, formData);
}

export async function uploadVenueImages(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  await requirePlatformAdmin();
  return uploadImages(TARGETS.venue, formData);
}
export async function removeVenueImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return removeImage(TARGETS.venue, formData);
}
export async function setVenueCoverImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  return setCoverImage(TARGETS.venue, formData);
}
