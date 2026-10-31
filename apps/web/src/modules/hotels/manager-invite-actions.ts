"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { MANAGER_PERMISSION_KEYS, isManagerPermission } from "@/modules/hotels/manager-permissions";
import { prepareManagerCredentials, deliverManagerCredentials, sendManagerResetLink } from "@/lib/managers/credentials";
import type { EmailStatus } from "@/lib/notifications/email";

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

/** Assigns a manager identity after authorizing this hotel; delivers credentials only after assignment. */
export async function addHotelManager(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { managerCode?: string; emailStatus?: EmailStatus }> {
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

  try {
    const identity = await prepareManagerCredentials(parsed.data.email);
    const supabase = await createClient();
    const { data: assigned } = await supabase.from("hotel_managers").select("id")
      .eq("hotel_id", parsed.data.hotelId).eq("profile_id", identity.profileId).eq("status", "active").maybeSingle();
    if (!assigned) {
      const { error } = await supabase.rpc("add_hotel_manager", {
        p_hotel_id: parsed.data.hotelId, p_email: identity.loginEmail, p_permissions: parsed.data.permissions,
      });
      if (error) return { error: error.code === "23505" ? "That manager is already assigned." : error.message };
    }
    const emailStatus = await deliverManagerCredentials(identity.profileId);
    revalidatePath(`/admin/hotels/${parsed.data.hotelId}`);
    revalidatePath(`/partner/hotels/${parsed.data.hotelId}`);
    return { error: null, managerCode: identity.managerCode, emailStatus };
  } catch (cause) {
    unstable_rethrow(cause);
    return { error: cause instanceof Error ? cause.message : "Manager could not be assigned." };
  }
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

/** Sends a recovery link without changing or disclosing a password. */
export async function resetHotelManagerPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { managerCode?: string; emailStatus?: EmailStatus }> {
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
    .eq("status", "active")
    .maybeSingle();
  if (!manager) return { error: "Manager not found." };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from("profiles").select("manager_code").eq("id", manager.profile_id).single();
  if (!profile?.manager_code) return { error: "Manager ID not found." };
  const emailStatus = await sendManagerResetLink(profile.manager_code);
  return { error: emailStatus === "sent" ? null : "Reset link was not sent. Try again later.", emailStatus };
}

export async function retryHotelManagerCredentialEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    await requireCanManageHotelManagers(hotelId);
    const parsed = resetPasswordSchema.safeParse({ hotelId, managerId: formData.get("managerId") });
    if (!parsed.success) return { error: "Invalid manager." };
    const supabase = await createClient();
    const { data: manager } = await supabase.from("hotel_managers").select("profile_id")
      .eq("id", parsed.data.managerId).eq("hotel_id", hotelId).eq("status", "active").maybeSingle();
    if (!manager) return { error: "Manager not found." };
    const emailStatus = await deliverManagerCredentials(manager.profile_id);
    return { error: emailStatus === "sent" ? null : "Credential email was not sent." };
  } catch (cause) {
    unstable_rethrow(cause);
    return { error: cause instanceof Error ? cause.message : "Credential email was not sent." };
  }
}
