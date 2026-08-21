"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const broadcastSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  body: z.string().trim().max(2000).optional(),
  audience: z.enum(["all_agency_owners", "all_agency_members"]),
});

/**
 * Pushes one notification per targeted profile. `notifications` already has
 * an admin "for all" RLS policy (see 20260101000010_notifications_audit_storage.sql),
 * so the standard RLS-scoped client is sufficient — no service-role client
 * needed here.
 *
 * Every row from one send shares a `broadcast_id` in `data` so the history
 * view can group N per-recipient rows back into one logical broadcast.
 */
export async function sendBroadcast(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePlatformAdmin();

  const parsed = broadcastSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  let membersQuery = supabase.from("agency_members").select("profile_id").eq("status", "active");
  if (parsed.data.audience === "all_agency_owners") {
    membersQuery = membersQuery.in("role_in_agency", ["owner", "admin"]);
  }
  const { data: members, error: membersError } = await membersQuery;
  if (membersError) return { error: membersError.message };

  const recipientIds = [...new Set((members ?? []).map((m) => m.profile_id))];
  if (recipientIds.length === 0) {
    return { error: "No active agency members match that audience." };
  }

  const broadcastId = crypto.randomUUID();
  const rows = recipientIds.map((profileId) => ({
    profile_id: profileId,
    type: "broadcast",
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    data: { broadcast_id: broadcastId, sent_by: admin.id, audience: parsed.data.audience },
  }));

  const { error: insertError } = await supabase.from("notifications").insert(rows);
  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/broadcasts");
  return { error: null };
}

export type BroadcastHistoryEntry = {
  broadcastId: string;
  title: string;
  body: string | null;
  audience: string;
  createdAt: string;
  recipientCount: number;
};

/** Groups per-recipient notification rows back into one entry per send. */
export async function getBroadcastHistory(limit = 20): Promise<BroadcastHistoryEntry[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("title, body, data, created_at")
    .eq("type", "broadcast")
    .order("created_at", { ascending: false })
    .limit(500);

  const byBroadcast = new Map<string, BroadcastHistoryEntry>();
  for (const row of data ?? []) {
    const d = row.data as { broadcast_id?: string; audience?: string } | null;
    const broadcastId = d?.broadcast_id;
    if (!broadcastId) continue;

    const existing = byBroadcast.get(broadcastId);
    if (existing) {
      existing.recipientCount += 1;
      continue;
    }
    byBroadcast.set(broadcastId, {
      broadcastId,
      title: row.title,
      body: row.body,
      audience: d?.audience ?? "unknown",
      createdAt: row.created_at,
      recipientCount: 1,
    });
  }

  return [...byBroadcast.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
