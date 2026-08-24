"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyManagedHotel, hasPermission } from "./manager-queries";

const profileSchema = z.object({
  hotelId: z.string().uuid(),
  description: z.string().max(4000).optional(),
  addressLine: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  contactEmail: z.string().email("Enter a valid contact email.").or(z.literal("")).optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.").or(z.literal("")).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.").or(z.literal("")).optional(),
});

/**
 * The manager's slice of the hotel row: operational fields only. Core
 * identity (name, slug, status, star rating, partner_id) stays with the
 * owning partner and STS — the RLS policy behind this ("hotels: manager
 * updates profile when permitted") is row-level, so this action's column
 * list IS the column boundary; keep it narrow.
 */
export async function updateHotelProfileAsManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let profileId: string;
  try {
    profileId = (await requireUser()).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = profileSchema.safeParse({
    hotelId: formData.get("hotelId"),
    description: formData.get("description") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    phone: formData.get("phone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    checkInTime: formData.get("checkInTime") || undefined,
    checkOutTime: formData.get("checkOutTime") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const managed = await getMyManagedHotel(profileId, parsed.data.hotelId);
  if (!managed || !hasPermission(managed, "profile")) {
    return { error: "You don't have permission to edit this hotel's profile." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hotels")
    .update({
      description: parsed.data.description ?? null,
      address_line: parsed.data.addressLine ?? null,
      phone: parsed.data.phone ?? null,
      contact_email: parsed.data.contactEmail || null,
      check_in_time: parsed.data.checkInTime || null,
      check_out_time: parsed.data.checkOutTime || null,
    })
    .eq("id", parsed.data.hotelId);
  if (error) return { error: error.message };

  revalidatePath(`/manager/${parsed.data.hotelId}/profile`);
  return { error: null };
}
