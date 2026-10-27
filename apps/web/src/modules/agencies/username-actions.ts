"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

/**
 * Changes the signed-in member's Agent Portal username. set_agent_username
 * validates the format and uniqueness inside the agency; its messages are
 * written for this form.
 */
export async function updateMyAgentUsername(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_agent_username", {
    p_member_id: membership.memberId,
    p_username: String(formData.get("username") ?? ""),
  });
  if (error) return { error: error.message };

  revalidatePath("/agent", "layout");
  return { error: null };
}
