"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { uploadHotelLogo, removeHotelLogo } from "@/modules/hotels/logo-storage";

export async function uploadHotelLogoAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const hotelId = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image to upload." };

  const result = await uploadHotelLogo(hotelId, file);
  if (!result.error) revalidatePath(`/admin/hotels/${hotelId}`);
  return result;
}

export async function removeHotelLogoAdmin(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const hotelId = String(formData.get("id") ?? "");
  await removeHotelLogo(hotelId);
  revalidatePath(`/admin/hotels/${hotelId}`);
}
