"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { VENUE_MANAGER_PERMISSION_KEYS, isVenueManagerPermission } from "@/modules/events/venue-manager-permissions";
import { prepareManagerCredentials, deliverManagerCredentials, sendManagerResetLink } from "@/lib/managers/credentials";
import type { EmailStatus } from "@/lib/notifications/email";

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

/** Assigns a manager identity after authorizing this venue; delivers credentials only after assignment. */
export async function addVenueManager(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { managerCode?: string; emailStatus?: EmailStatus }> {
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

  try {
    const identity = await prepareManagerCredentials(parsed.data.email);
    const supabase = await createClient();
    const { data: assigned } = await supabase.from("venue_managers").select("id")
      .eq("venue_id", parsed.data.venueId).eq("profile_id", identity.profileId).eq("status", "active").maybeSingle();
    if (!assigned) {
      const { error } = await supabase.rpc("add_venue_manager", {
        p_venue_id: parsed.data.venueId, p_email: identity.loginEmail, p_permissions: parsed.data.permissions,
      });
      if (error) return { error: error.code === "23505" ? "That manager is already assigned." : error.message };
    }
    const emailStatus = await deliverManagerCredentials(identity.profileId);
    revalidatePath(`/admin/events/${parsed.data.venueId}`);
    revalidatePath("/venue/venues");
    return { error: null, managerCode: identity.managerCode, emailStatus };
  } catch (cause) {
    unstable_rethrow(cause);
    return { error: cause instanceof Error ? cause.message : "Manager could not be assigned." };
  }
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

/** Sends a recovery link without changing or disclosing a password. */
export async function resetVenueManagerPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { managerCode?: string; emailStatus?: EmailStatus }> {
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
    .eq("status", "active")
    .maybeSingle();
  if (!manager) return { error: "Manager not found." };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from("profiles").select("manager_code").eq("id", manager.profile_id).single();
  if (!profile?.manager_code) return { error: "Manager ID not found." };
  const emailStatus = await sendManagerResetLink(profile.manager_code);
  return { error: emailStatus === "sent" ? null : "Reset link was not sent. Try again later.", emailStatus };
}

export async function retryVenueManagerCredentialEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    await requireCanManageVenueManagers(venueId);
    const parsed = resetPasswordSchema.safeParse({ venueId, managerId: formData.get("managerId") });
    if (!parsed.success) return { error: "Invalid manager." };
    const supabase = await createClient();
    const { data: manager } = await supabase.from("venue_managers").select("profile_id")
      .eq("id", parsed.data.managerId).eq("venue_id", venueId).eq("status", "active").maybeSingle();
    if (!manager) return { error: "Manager not found." };
    const emailStatus = await deliverManagerCredentials(manager.profile_id);
    return { error: emailStatus === "sent" ? null : "Credential email was not sent." };
  } catch (cause) {
    unstable_rethrow(cause);
    return { error: cause instanceof Error ? cause.message : "Credential email was not sent." };
  }
}
