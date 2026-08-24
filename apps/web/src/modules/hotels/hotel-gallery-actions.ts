"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope } from "@/modules/hotels/partner-queries";
import { uploadImages, removeImage, setCoverImage, type GalleryTarget } from "@/modules/admin/property-gallery-actions";
import type { ActionState } from "@/lib/auth/actions";

const TARGET: GalleryTarget = {
  table: "hotels",
  bucket: "hotel-images",
  pathPrefix: (id) => id,
  revalidate: (id) => revalidatePath(`/partner/hotels/${id}`),
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

export async function uploadHotelImagesPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
