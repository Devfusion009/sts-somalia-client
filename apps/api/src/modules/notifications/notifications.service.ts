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

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async dismiss(userId: string, notificationId: string) {
    const { error } = await this.rls
      .get()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("profile_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  async getUnreadOrderCount(userId: string) {
    const { count, error } = await this.rls.get().from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId).eq("type", "new_order").is("read_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  }

  async getAdminNavCounts() {
    const { data, error } = await this.rls.get().rpc("admin_nav_counts");
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  }

  /** Opening one order never acknowledges another order or another staff member's inbox. */
  async readOrder(userId: string, orderId: string) {
    const { error } = await this.rls.get().from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", userId).eq("type", "new_order")
      .eq("data->>order_id", orderId).is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  /** Explicit dismissal of a notification category; opening a list does not call this. */
  async dismissType(userId: string, type: string) {
    const { error } = await this.rls
      .get()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", userId)
      .eq("type", type)
      .is("read_at", null);
    if (error) throw new Error(error.message);
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
    const byBroadcast = new Map<string, BroadcastHistoryEntry>();
    const pageSize = 500;
    // Finish the oldest included broadcast before stopping, so a large send
    // cannot truncate recipient counts or hide all earlier sends.
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.rls.get().from("notifications")
        .select("id, title, body, data, created_at")
        .eq("type", "broadcast")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const d = row.data as { broadcast_id?: string; audience?: string } | null;
        const broadcastId = d?.broadcast_id;
        if (!broadcastId) continue;
        const existing = byBroadcast.get(broadcastId);
        if (existing) { existing.recipientCount += 1; continue; }
        if (byBroadcast.size >= limit) return [...byBroadcast.values()];
        byBroadcast.set(broadcastId, {
          broadcastId, title: row.title, body: row.body,
          audience: d?.audience ?? "unknown", createdAt: row.created_at, recipientCount: 1,
        });
      }
      if (!data || data.length < pageSize) break;
    }
    return [...byBroadcast.values()];
  }
}
