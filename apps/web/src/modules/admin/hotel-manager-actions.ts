"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const addManagerSchema = z.object({
  hotelId: z.string().uuid(),
  email: z.string().email("Enter a valid email address."),
  canManageBookings: z.boolean(),
  canManagePhotos: z.boolean(),
});

function generateTempPassword(): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `Sts-${raw.slice(0, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Assigns any email address as the manager of one hotel. The person doesn't
 * need an existing STS account: if profiles has no row for that email, one
 * is created here via the service-role Auth admin API (which fires
 * handle_new_user and gives them a profile) with a random temp password
 * that's returned once for the admin to relay out of band — same shape as
 * adminResetPartnerMemberPassword. Either way, admin_add_hotel_manager
 * (20260820000003) then does the lookup-by-email, insert, and conditional
 * role promotion atomically.
 */
export async function adminAddHotelManager(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { newPassword?: string }> {
  await requirePlatformAdmin();
  const parsed = addManagerSchema.safeParse({
    hotelId: formData.get("hotelId"),
    email: formData.get("email"),
    canManageBookings: formData.get("canManageBookings") === "on",
    canManagePhotos: formData.get("canManagePhotos") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  let newPassword: string | undefined;
  if (!existing) {
    newPassword = generateTempPassword();
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      password: newPassword,
      email_confirm: true,
    });
    if (createError) return { error: createError.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_hotel_manager", {
    p_hotel_id: parsed.data.hotelId,
    p_email: parsed.data.email,
    p_can_manage_bookings: parsed.data.canManageBookings,
    p_can_manage_photos: parsed.data.canManagePhotos,
  });
  if (error) {
    if (error.code === "23505") return { error: "That person already manages this hotel." };
    return { error: error.message };
  }

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  return { error: null, newPassword };
}

const updatePermissionsSchema = z.object({
  hotelId: z.string().uuid(),
  managerId: z.string().uuid(),
  canManageBookings: z.boolean(),
  canManagePhotos: z.boolean(),
});

export async function adminUpdateHotelManagerPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = updatePermissionsSchema.safeParse({
    hotelId: formData.get("hotelId"),
    managerId: formData.get("managerId"),
    canManageBookings: formData.get("canManageBookings") === "on",
    canManagePhotos: formData.get("canManagePhotos") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_hotel_manager_permissions", {
    p_manager_id: parsed.data.managerId,
    p_can_manage_bookings: parsed.data.canManageBookings,
    p_can_manage_photos: parsed.data.canManagePhotos,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  return { error: null };
}

const removeManagerSchema = z.object({
  hotelId: z.string().uuid(),
  managerId: z.string().uuid(),
});

export async function adminRemoveHotelManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = removeManagerSchema.safeParse({
    hotelId: formData.get("hotelId"),
    managerId: formData.get("managerId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_hotel_manager", { p_manager_id: parsed.data.managerId });
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  return { error: null };
}
