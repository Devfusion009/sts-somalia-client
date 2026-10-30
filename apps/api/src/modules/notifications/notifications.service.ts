import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { SendBroadcastInput } from "@sts/shared-types";

export type BroadcastHistoryEntry = {
  broadcastId: string;
  title: string;
  body: string | null;
  audience: string;
  createdAt: string;
  recipientCount: number;
};

/**
 * Direct port of apps/web's modules/notifications/{queries,actions,broadcast-actions}.ts.
 * This is the in-app notification-record system (the `notifications` table —
 * bell/banner reads, admin broadcasts) — a different system from
 * apps/web's lib/notifications/* outbound send infrastructure, which is not
 * part of this migration.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly rls: RlsSupabaseService) {}

  async getUnread(userId: string, opts?: { type?: string; limit?: number }) {
    let query = this.rls
      .get()
      .from("notifications")
      .select("id, type, title, body, data, created_at")
      .eq("profile_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 10);

    if (opts?.type) {
      query = query.eq("type", opts.type);
    }

    const { data } = await query;
    return data ?? [];
  }

  async dismiss(userId: string, notificationId: string) {
    await this.rls
      .get()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("profile_id", userId);
    return { ok: true as const };
  }

  /** Marks every unread notification of one type as read, e.g. all new-order alerts once the Orders page is opened. */
  async dismissType(userId: string, type: string) {
    await this.rls
      .get()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", userId)
      .eq("type", type)
      .is("read_at", null);
    return { ok: true as const };
  }

  /**
   * `notifications` already has an admin "for all" RLS policy (see
   * 20260101000010_notifications_audit_storage.sql), so the standard
   * RLS-scoped client is sufficient — no service-role client needed here,
   * same as the original apps/web implementation.
   *
   * Every row from one send shares a `broadcast_id` in `data` so the
   * history view can group N per-recipient rows back into one logical
   * broadcast.
   */
  async sendBroadcast(adminId: string, input: SendBroadcastInput) {
    const client = this.rls.get();

    let membersQuery = client.from("agency_members").select("profile_id").eq("status", "active");
    if (input.audience === "all_agency_owners") {
      membersQuery = membersQuery.in("role_in_agency", ["owner", "admin"]);
    }
    const { data: members, error: membersError } = await membersQuery;
    if (membersError) throw new Error(membersError.message);

    const recipientIds = [...new Set((members ?? []).map((m) => m.profile_id))];
    if (recipientIds.length === 0) {
      throw new Error("No active agency members match that audience.");
    }

    const broadcastId = crypto.randomUUID();
    const rows = recipientIds.map((profileId) => ({
      profile_id: profileId,
      type: "broadcast",
      title: input.title,
      body: input.body ?? null,
      data: { broadcast_id: broadcastId, sent_by: adminId, audience: input.audience },
    }));

    const { error: insertError } = await client.from("notifications").insert(rows);
    if (insertError) throw new Error(insertError.message);

    return { ok: true as const, recipientCount: recipientIds.length };
  }

  async getBroadcastHistory(limit = 20): Promise<BroadcastHistoryEntry[]> {
    const { data } = await this.rls
      .get()
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

    return [...byBroadcast.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}
