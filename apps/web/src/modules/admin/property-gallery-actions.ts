"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
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
  revalidate: (id: string) => void;
};

export const TARGETS: Record<"hotel" | "room" | "venue", GalleryTarget> = {
  hotel: {
    table: "hotels",
    bucket: "hotel-images",
    pathPrefix: (id) => `${id}`,
    revalidate: (id) => {
      revalidatePath(`/admin/hotels/${id}`);
      revalidatePath("/admin/hotels");
    },
  },
  room: {
    table: "hotel_rooms",
    bucket: "hotel-images",
    pathPrefix: (id) => `rooms/${id}`,
    revalidate: () => revalidatePath(`/admin/hotels`, "layout"),
  },
  venue: {
    table: "event_venues",
    bucket: "venue-images",
    pathPrefix: (id) => `${id}`,
    revalidate: (id) => {
      revalidatePath(`/admin/events/${id}`);
      revalidatePath("/admin/events");
    },
  },
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
export async function uploadImages(target: GalleryTarget, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Unknown record." };

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

  target.revalidate(id);
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
  target.revalidate(id);
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
  target.revalidate(id);
}

export async function uploadHotelImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
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

export async function uploadRoomImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
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

export async function uploadVenueImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
