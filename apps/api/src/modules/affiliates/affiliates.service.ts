import { Injectable, NotFoundException } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { CreateAffiliateLinkInput, RecordAffiliatePayoutInput } from "@sts/shared-types";

function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Direct port of apps/web's modules/affiliates/{queries,actions,admin-actions}.ts.
 * A plain @Injectable() — it becomes request-scoped automatically because it
 * depends on RlsSupabaseService (Scope.REQUEST); Nest propagates scope up
 * through the dependency graph, same rule that makes this work identically
 * whether the caller is a REST controller or (via ctx.resolve()) a tRPC
 * procedure.
 */
@Injectable()
export class AffiliatesService {
  constructor(private readonly rls: RlsSupabaseService) {}

  async getMyAffiliate(userId: string) {
    const { data } = await this.rls
      .get()
      .from("affiliates")
      .select("*")
      .eq("profile_id", userId)
      .maybeSingle();
    return data;
  }

  async getMyLinks(affiliateId: string) {
    const { data } = await this.rls
      .get()
      .from("affiliate_links")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async getMyConversions(affiliateId: string) {
    const { data } = await this.rls
      .get()
      .from("affiliate_conversions")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async getMyPayouts(affiliateId: string) {
    const { data } = await this.rls
      .get()
      .from("commission_payouts")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  /** Combines the four reads affiliate/page.tsx needs into one round trip. */
  async getDashboard(userId: string) {
    const affiliate = await this.getMyAffiliate(userId);
    if (!affiliate) {
      return { affiliate: null, links: [], conversions: [], payouts: [] };
    }
    const [links, conversions, payouts] = await Promise.all([
      this.getMyLinks(affiliate.id),
      this.getMyConversions(affiliate.id),
      this.getMyPayouts(affiliate.id),
    ]);
    return { affiliate, links, conversions, payouts };
  }

  async createLink(userId: string, input: CreateAffiliateLinkInput) {
    const affiliate = await this.getMyAffiliate(userId);
    if (!affiliate) {
      throw new NotFoundException("No affiliate account found for your profile.");
    }

    let lastError: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await this.rls.get().from("affiliate_links").insert({
        affiliate_id: affiliate.id,
        campaign_name: input.campaignName ?? null,
        target_path: input.targetPath,
        code: randomCode(),
      });

      if (!error) return { ok: true as const };

      // Unique-constraint conflict on `code` — retry with a fresh random code.
      if (error.code === "23505") {
        lastError = error.message;
        continue;
      }

      throw new Error(error.message);
    }

    throw new Error(lastError ?? "Could not generate a unique link code, try again.");
  }

  /**
   * Records a commission payout already sent outside the system and marks
   * matching approved conversions as paid — atomically, via
   * record_affiliate_commission_payout. The RPC checks is_admin() itself
   * (defense in depth), so the caller's normal RLS-scoped client is enough —
   * this deliberately does NOT use AdminSupabaseService.
   */
  async recordPayout(input: RecordAffiliatePayoutInput) {
    const { error } = await this.rls.get().rpc("record_affiliate_commission_payout", {
      target_affiliate_id: input.affiliateId,
      payout_amount: input.amount,
      payout_method: input.method,
      payout_ref: input.reference,
      target_period_start: input.periodStart,
      target_period_end: input.periodEnd,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }
}
