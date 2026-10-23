import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { throwIfDbError } from "../../../common/errors/db-error";

/** Data access for venue_partners / venue_partner_members. */
@Injectable()
export class VenuePartnerRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  async findActivePartnerId(profileId: string): Promise<string | null> {
    const { data, error } = await this.rls
      .get()
      .from("venue_partner_members")
      .select("partner_id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    throwIfDbError(error, "Your partner account could not be loaded.");
    return data?.partner_id ?? null;
  }

  async findPartner(partnerId: string) {
    const { data, error } = await this.rls
      .get()
      .from("venue_partners")
      .select("id, name, contact_email, contact_phone, status, commission_rate")
      .eq("id", partnerId)
      .maybeSingle();
    throwIfDbError(error, "Your partner account could not be loaded.");
    return data;
  }
}
