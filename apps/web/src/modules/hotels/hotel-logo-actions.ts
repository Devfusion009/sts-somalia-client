"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/auth/actions";
import { requireHotelPhotoAccess } from "./hotel-gallery-actions";
import { uploadHotelLogo, removeHotelLogo } from "./logo-storage";

/** Same access rule as the photo gallery (requireHotelPhotoAccess) — the logo is media, not listing identity. */
export async function uploadHotelLogoPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const hotelId = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image to upload." };

  try {
    await requireHotelPhotoAccess(hotelId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const result = await uploadHotelLogo(hotelId, file);
  if (!result.error) {
    revalidatePath(`/partner/hotels/${hotelId}`);
    revalidatePath(`/admin/hotels/${hotelId}`);
  }
  return result;
}

export async function removeHotelLogoPartner(formData: FormData): Promise<void> {
  const hotelId = String(formData.get("id") ?? "");
  await requireHotelPhotoAccess(hotelId);
  await removeHotelLogo(hotelId);
  revalidatePath(`/partner/hotels/${hotelId}`);
  revalidatePath(`/admin/hotels/${hotelId}`);
}
