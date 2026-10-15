"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { MANAGER_PERMISSION_KEYS, isManagerPermission } from "@/modules/hotels/manager-permissions";
import { deliverManagerCredentials, generateTempPassword } from "@/modules/identity/manager-credentials";

/**
 * One implementation for assigning/managing a hotel's managers, called by
 * both the admin console and the hotel partner portal — authorization is a
 * runtime check against can_manage_hotel_managers() (admin OR the hotel's
 * owning partner, see migration 20260824000001) rather than a hardcoded
 * role gate, so this file has no admin-only or partner-only branch to keep
 * in sync. Changing the manager flow means editing these functions once.
 */
async function requireCanManageHotelManagers(hotelId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_manage_hotel_managers", { p_hotel_id: hotelId });
  if (error || !data) {
    throw new Error("You don't have permission to manage this hotel's managers.");
  }
}

function permissionsFrom(formData: FormData): string[] {
  return formData.getAll("permissions").map(String).filter(isManagerPermission);
}

const addManagerSchema = z.object({
  hotelId: z.string().uuid(),
  email: z.string().email("Enter a valid email address."),
  permissions: z.array(z.enum(MANAGER_PERMISSION_KEYS as [string, ...string[]])),
});

/**
 * Assigns any email address as the manager of one hotel. The person doesn't
 * need an existing STS account: if profiles has no row for that email, one
 * is created here via the service-role Auth admin API (which fires
 * handle_new_user and gives them a profile) with a random temp password
 * that's delivered via deliverManagerCredentials above. Either way,
 * add_hotel_manager then does the lookup-by-email, insert, and conditional
 * role promotion atomically.
 */
export async function addHotelManager(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { newPassword?: string }> {
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    await requireCanManageHotelManagers(hotelId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = addManagerSchema.safeParse({
    hotelId,
    email: formData.get("email"),
    permissions: permissionsFrom(formData),
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
    const password = generateTempPassword();
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true,
    });
    if (createError) return { error: createError.message };
    newPassword = (await deliverManagerCredentials(parsed.data.email, password)).password ?? undefined;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_hotel_manager", {
    p_hotel_id: parsed.data.hotelId,
    p_email: parsed.data.email,
    p_permissions: parsed.data.permissions,
  });
  if (error) {
    if (error.code === "23505") return { error: "That person already manages this hotel." };
    return { error: error.message };
  }

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  revalidatePath(`/partner/hotels/${parsed.data.hotelId}`);
  return { error: null, newPassword };
}

const updatePermissionsSchema = z.object({
  hotelId: z.string().uuid(),
  managerId: z.string().uuid(),
  permissions: z.array(z.enum(MANAGER_PERMISSION_KEYS as [string, ...string[]])),
});

export async function updateHotelManagerPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    await requireCanManageHotelManagers(hotelId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = updatePermissionsSchema.safeParse({
    hotelId,
    managerId: formData.get("managerId"),
    permissions: permissionsFrom(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_hotel_manager_permissions", {
    p_manager_id: parsed.data.managerId,
    p_permissions: parsed.data.permissions,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  revalidatePath(`/partner/hotels/${parsed.data.hotelId}`);
  return { error: null };
}

const removeManagerSchema = z.object({
  hotelId: z.string().uuid(),
  managerId: z.string().uuid(),
});

export async function removeHotelManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    await requireCanManageHotelManagers(hotelId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = removeManagerSchema.safeParse({ hotelId, managerId: formData.get("managerId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_hotel_manager", { p_manager_id: parsed.data.managerId });
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
  revalidatePath(`/partner/hotels/${parsed.data.hotelId}`);
  return { error: null };
}

const resetPasswordSchema = z.object({
  hotelId: z.string().uuid(),
  managerId: z.string().uuid(),
});

/** Re-issues a manager's password — same shape as adminResetPartnerMemberPassword. */
export async function resetHotelManagerPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { newPassword?: string }> {
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    await requireCanManageHotelManagers(hotelId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = resetPasswordSchema.safeParse({ hotelId, managerId: formData.get("managerId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: manager } = await supabase
    .from("hotel_managers")
    .select("profile_id, profile:profiles!hotel_managers_profile_id_fkey(email)")
    .eq("id", parsed.data.managerId)
    .eq("hotel_id", parsed.data.hotelId)
    .maybeSingle();
  if (!manager) return { error: "Manager not found." };

  const password = generateTempPassword();
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(manager.profile_id, { password });
  if (error) return { error: error.message };

  const email = (manager.profile as unknown as { email: string } | null)?.email ?? "";
  const delivered = await deliverManagerCredentials(email, password);
  return { error: null, newPassword: delivered.password ?? undefined };
}
