import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { UpdateProfileInput } from "@sts/shared-types";

/**
 * Direct port of apps/web's modules/identity/actions.ts::updateProfileAction
 * ONLY — identity/queries.ts::getMyPartnerContexts and its helpers are
 * deliberately NOT here. That's a cross-domain aggregator over
 * agencies/hotels/events/admin, none of which have migrated yet (phases
 * 4/5/7) — see the comment on apps/web's identity/queries.ts for the full
 * reasoning. It stays entirely in apps/web until those dependencies land.
 */
@Injectable()
export class IdentityService {
  constructor(private readonly rls: RlsSupabaseService) {}

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const { error } = await this.rls
      .get()
      .from("profiles")
      .update({
        full_name: input.fullName,
        phone: input.phone ?? null,
        country_code: input.countryCode ?? null,
      })
      .eq("id", userId);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  }
}
