"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { VENUE_MANAGER_PERMISSION_KEYS, isVenueManagerPermission } from "@/modules/events/venue-manager-permissions";
import { deliverManagerCredentials, generateTempPassword } from "@/modules/identity/manager-credentials";

/**
 * Assigning and managing a venue's managers — the venue counterpart of
 * hotels/manager-invite-actions.ts, called by both the admin console and the
 * venue partner portal. Authorization is can_manage_venue_managers() (admin
 * OR the venue's owning partner, migration 20261013000003) at runtime, so
 * there is no admin-only or partner-only branch here.
 */
async function requireCanManageVenueManagers(venueId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_manage_venue_managers", { p_venue_id: venueId });
  if (error || !data) {
    throw new Error("You don't have permission to manage this venue's managers.");
  }
}

function permissionsFrom(formData: FormData): string[] {
  return formData.getAll("permissions").map(String).filter(isVenueManagerPermission);
}

const addManagerSchema = z.object({
  venueId: z.string().uuid(),
  email: z.string().email("Enter a valid email address."),
  permissions: z.array(z.enum(VENUE_MANAGER_PERMISSION_KEYS as [string, ...string[]])),
});

/**
 * Assigns any email address as the manager of one venue. The person doesn't
 * need an existing STS account: if profiles has no row for that email, one
 * is created here via the service-role Auth admin API (which fires
 * handle_new_user and gives them a profile) with a random temp password
 * that's delivered via deliverManagerCredentials above. Either way,
 * add_venue_manager then does the lookup-by-email, insert, and conditional
 * role promotion atomically.
 */
export async function addVenueManager(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { newPassword?: string }> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    await requireCanManageVenueManagers(venueId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = addManagerSchema.safeParse({
    venueId,
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
  const { error } = await supabase.rpc("add_venue_manager", {
    p_venue_id: parsed.data.venueId,
    p_email: parsed.data.email,
    p_permissions: parsed.data.permissions,
  });
  if (error) {
    if (error.code === "23505") return { error: "That person already manages this venue." };
    return { error: error.message };
  }

  revalidatePath(`/admin/events/${parsed.data.venueId}`);
  revalidatePath("/venue/venues");
  return { error: null, newPassword };
}

const updatePermissionsSchema = z.object({
  venueId: z.string().uuid(),
  managerId: z.string().uuid(),
  permissions: z.array(z.enum(VENUE_MANAGER_PERMISSION_KEYS as [string, ...string[]])),
});

export async function updateVenueManagerPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    await requireCanManageVenueManagers(venueId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = updatePermissionsSchema.safeParse({
    venueId,
    managerId: formData.get("managerId"),
    permissions: permissionsFrom(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_venue_manager_permissions", {
    p_manager_id: parsed.data.managerId,
    p_permissions: parsed.data.permissions,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/events/${parsed.data.venueId}`);
  revalidatePath("/venue/venues");
  return { error: null };
}

const removeManagerSchema = z.object({
  venueId: z.string().uuid(),
  managerId: z.string().uuid(),
});

export async function removeVenueManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    await requireCanManageVenueManagers(venueId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = removeManagerSchema.safeParse({ venueId, managerId: formData.get("managerId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_venue_manager", { p_manager_id: parsed.data.managerId });
  if (error) return { error: error.message };

  revalidatePath(`/admin/events/${parsed.data.venueId}`);
  revalidatePath("/venue/venues");
  return { error: null };
}

const resetPasswordSchema = z.object({
  venueId: z.string().uuid(),
  managerId: z.string().uuid(),
});

/** Re-issues a manager's password — same shape as adminResetPartnerMemberPassword. */
export async function resetVenueManagerPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { newPassword?: string }> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    await requireCanManageVenueManagers(venueId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = resetPasswordSchema.safeParse({ venueId, managerId: formData.get("managerId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: manager } = await supabase
    .from("venue_managers")
    .select("profile_id, profile:profiles!venue_managers_profile_id_fkey(email)")
    .eq("id", parsed.data.managerId)
    .eq("venue_id", parsed.data.venueId)
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
