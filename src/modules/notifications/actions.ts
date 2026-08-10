"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

/** Dismisses one notification for the current user (marks it read). */
export async function dismissNotification(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const notificationId = z.string().uuid().parse(formData.get("notificationId"));
  const path = formData.get("path");

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", profile.id);

  if (typeof path === "string" && path) {
    revalidatePath(path);
  }
}
