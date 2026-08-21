"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

const assignableRoles = z.enum(["admin", "booking_staff", "accountant", "viewer"]);

const addMemberSchema = z.object({
  email: z.string().email("Enter a valid email."),
  role: assignableRoles,
});

/**
 * Owner/admin adds an existing account to the agency. RLS
 * ("agency_members: owner or admin adds members") is the real
 * authorization boundary and also blocks role: 'owner' outright; the
 * membership check here just gives a clearer error than a bare RLS denial.
 *
 * The by-email lookup uses the admin client on purpose: profiles SELECT is
 * self-or-admin only under RLS, so an owner/admin has no RLS-scoped way to
 * resolve a teammate's account by email. The caller's own authorization is
 * still fully enforced by RLS on the subsequent insert — this lookup only
 * ever reveals whether an account with that email exists.
 */
export async function addTeamMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") {
    return { error: "Only the agency owner or an admin can add team members." };
  }

  const parsed = addMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (!target) {
    return {
      error:
        "No STS account found with that email. Ask them to sign up first, then add them here.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("agency_members").insert({
    agency_id: membership.agency.id,
    profile_id: target.id,
    role_in_agency: parsed.data.role,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That person is already on your team." };
    }
    return { error: error.message };
  }

  revalidatePath("/agent/team");
  return { error: null };
}

const updateRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: assignableRoles,
});

export async function updateTeamMemberRole(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") {
    return { error: "Only the agency owner or an admin can change roles." };
  }

  const parsed = updateRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_members")
    .update({ role_in_agency: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("agency_id", membership.agency.id);

  if (error) {
    return { error: "Could not update that member's role — the owner's role can't be changed." };
  }

  revalidatePath("/agent/team");
  return { error: null };
}

export async function removeTeamMember(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return;
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") return;

  const memberId = z.string().uuid().parse(formData.get("memberId"));
  const supabase = await createClient();
  await supabase
    .from("agency_members")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("agency_id", membership.agency.id);

  revalidatePath("/agent/team");
}
