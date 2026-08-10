import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Unread notifications for the current user, most recent first. */
export async function getUnreadNotifications(profileId: string, opts?: { type?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, type, title, body, data, created_at")
    .eq("profile_id", profileId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 10);

  if (opts?.type) {
    query = query.eq("type", opts.type);
  }

  const { data } = await query;
  return data ?? [];
}
