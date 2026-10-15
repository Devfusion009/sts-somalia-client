"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope } from "@/modules/hotels/partner-queries";
import { uploadImages, removeImage, setCoverImage, type GalleryTarget, type GalleryUploadState } from "@/modules/admin/property-gallery-actions";
import type { ActionState } from "@/lib/auth/actions";

const TARGET: GalleryTarget = {
  table: "hotels",
  bucket: "hotel-images",
  pathPrefix: (id) => id,
  revalidate: (id) => revalidatePath(`/partner/hotels/${id}`),
};

/**
 * Same bucket/table/path shape as admin's room target (property-gallery-
 * actions.ts TARGETS.room) — only the revalidate paths and auth differ. Both
 * portal trees, since the manager rooms page reuses this same room dialog
 * (see app/manager/[hotelId]/rooms/page.tsx).
 */
const ROOM_TARGET: GalleryTarget = {
  table: "hotel_rooms",
  bucket: "hotel-images",
  pathPrefix: (id) => `rooms/${id}`,
  revalidate: () => {
    revalidatePath("/partner", "layout");
    revalidatePath("/manager", "layout");
  },
};

/**
 * A hotel_partner owner can always manage their own hotel's photos; a
 * hotel_manager only when admin granted the 'photos' permission (20260821000002)
 * — checked here for a clean error message, and enforced for real by RLS
 * ("hotels: manager updates photos when permitted" / "hotels: partner
 * manages own"), which is what actually stops a manager without the flag.
 */
export async function requireHotelPhotoAccess(hotelId: string): Promise<void> {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  if (!scope.hotelIds.includes(hotelId)) throw new Error("Hotel not found.");

  const supabase = await createClient();
  if (scope.partnerId !== null) {
    const { data: hotel } = await supabase.from("hotels").select("partner_id").eq("id", hotelId).maybeSingle();
    if (hotel?.partner_id === scope.partnerId) return;
  }

  const { data: manager } = await supabase
    .from("hotel_managers")
    .select("permissions")
    .eq("hotel_id", hotelId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  if (!manager?.permissions.includes("photos")) throw new Error("You don't have permission to manage this hotel's photos.");
}

/**
 * A room's own photos are part of editing that room, not the hotel's
 * property-level gallery — same scope check createRoom/updateRoom already
 * use (partner-actions.ts's requireHotelScope), not the separate 'photos'
 * permission above, which gates the hotel's own marketing photos and logo.
 * Takes only the room id (GalleryManager's forms have no field for a second
 * one) and derives the owning hotel from the row itself.
 */
export async function requireRoomPhotoAccess(roomId: string): Promise<void> {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data: room } = await supabase.from("hotel_rooms").select("hotel_id").eq("id", roomId).maybeSingle();
  if (!room) throw new Error("Room not found.");
  if (profile.is_platform_admin) return;

  const scope = await getMyHotelScope(profile.id);
  if (!scope.hotelIds.includes(room.hotel_id)) throw new Error("Room not found.");
}

/** Bundles a newly created room's required photos into its own insert — see createRoom in partner-actions.ts. Caller has already authorized the hotel; this only performs the upload. */
export async function attachRoomPhotos(roomId: string, photos: File[]): Promise<ActionState> {
  const form = new FormData();
  form.set("id", roomId);
  for (const photo of photos) form.append("files", photo);
  return uploadImages(ROOM_TARGET, form);
}

export async function uploadRoomImagesPartner(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  const roomId = String(formData.get("id") ?? "");
  try {
    await requireRoomPhotoAccess(roomId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return uploadImages(ROOM_TARGET, formData);
}

export async function removeRoomImagePartner(formData: FormData): Promise<void> {
  const roomId = String(formData.get("id") ?? "");
  await requireRoomPhotoAccess(roomId);
  return removeImage(ROOM_TARGET, formData);
}

export async function setRoomCoverImagePartner(formData: FormData): Promise<void> {
  const roomId = String(formData.get("id") ?? "");
  await requireRoomPhotoAccess(roomId);
  return setCoverImage(ROOM_TARGET, formData);
}

export async function uploadHotelImagesPartner(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  const hotelId = String(formData.get("id") ?? "");
  try {
    await requireHotelPhotoAccess(hotelId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return uploadImages(TARGET, formData);
}

export async function removeHotelImagePartner(formData: FormData): Promise<void> {
  const hotelId = String(formData.get("id") ?? "");
  await requireHotelPhotoAccess(hotelId);
  return removeImage(TARGET, formData);
}

export async function setHotelCoverImagePartner(formData: FormData): Promise<void> {
  const hotelId = String(formData.get("id") ?? "");
  await requireHotelPhotoAccess(hotelId);
  return setCoverImage(TARGET, formData);
}
