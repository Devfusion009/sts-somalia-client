import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { createAnonClient } from "../../../infra/supabase/supabase-clients";
import { throwIfDbError } from "../../../common/errors/db-error";

/** Columns a visitor may see; anything else on event_venues stays server-side. */
export const PUBLIC_VENUE_COLUMNS =
  "id, slug, name, tagline, description, city, address, phone, capacity_seated, capacity_standing, size_sqm, base_price, currency, price_unit, event_types, amenities, images, is_featured, policies";

const PARTNER_VENUE_COLUMNS =
  "id, name, slug, city, address, tagline, description, capacity_seated, capacity_standing, size_sqm, event_types, base_price, currency, price_unit, status, created_at";

export type VenueWrite = {
  name: string;
  city: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  size_sqm: number | null;
  event_types: string[];
  base_price: number;
  currency: string;
  price_unit: string;
  status?: "draft" | "pending_review";
};

/**
 * Data access for event_venues — the only file in this module that knows
 * table and column names. Public reads use the anon client (published rows
 * only, by RLS); everything else runs as the caller.
 */
@Injectable()
export class VenueRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  async findPublished() {
    const { data, error } = await createAnonClient()
      .from("event_venues")
      .select(PUBLIC_VENUE_COLUMNS)
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("name");
    throwIfDbError(error, "Venues could not be loaded.");
    return data ?? [];
  }

  async findPublishedBySlug(slug: string) {
    const { data, error } = await createAnonClient()
      .from("event_venues")
      .select(
        `${PUBLIC_VENUE_COLUMNS}, property_links(label, url, sort_order), property_reviews(id, author_name, rating, body, created_at, status)`
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    throwIfDbError(error, "The venue could not be loaded.");
    return data;
  }

  /** A published venue as the booking caller sees it, with the fields pricing and capacity need. */
  async findPublishedForBooking(venueId: string) {
    const { data, error } = await this.rls
      .get()
      .from("event_venues")
      .select("id, name, partner_id, base_price, currency, price_unit, capacity_seated, capacity_standing")
      .eq("id", venueId)
      .eq("status", "published")
      .maybeSingle();
    throwIfDbError(error, "The venue could not be loaded.");
    return data;
  }

  async isSlotAvailable(venueId: string, start: string, end: string, from?: string, to?: string) {
    const { data, error } = await this.rls.get().rpc("venue_slot_available", {
      p_venue_id: venueId,
      p_start: start,
      p_end: end,
      p_from: from,
      p_to: to,
    });
    throwIfDbError(error, "Availability could not be checked.");
    return data !== false;
  }

  async findOccupiedRanges(venueId: string, from: string, to: string) {
    const { data, error } = await this.rls.get().rpc("get_venue_occupied_ranges", {
      target_venue_id: venueId,
      from_date: from,
      to_date: to,
    });
    throwIfDbError(error, "Availability could not be loaded.");
    return data ?? [];
  }

  async findByPartner(partnerId: string) {
    const { data, error } = await this.rls
      .get()
      .from("event_venues")
      .select(PARTNER_VENUE_COLUMNS)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    throwIfDbError(error, "Venues could not be loaded.");
    return data ?? [];
  }

  async findOneByPartner(partnerId: string, venueId: string) {
    const { data, error } = await this.rls
      .get()
      .from("event_venues")
      .select(PARTNER_VENUE_COLUMNS)
      .eq("partner_id", partnerId)
      .eq("id", venueId)
      .maybeSingle();
    throwIfDbError(error, "The venue could not be loaded.");
    return data;
  }

  async findIdsByPartner(partnerId: string): Promise<string[]> {
    const { data, error } = await this.rls.get().from("event_venues").select("id").eq("partner_id", partnerId);
    throwIfDbError(error, "Venues could not be loaded.");
    return (data ?? []).map((v: { id: string }) => v.id);
  }

  async insertForPartner(partnerId: string, slug: string, row: VenueWrite) {
    const { error } = await this.rls.get().from("event_venues").insert({ ...row, slug, partner_id: partnerId });
    throwIfDbError(error, "The venue could not be saved.");
  }

  async updateForPartner(partnerId: string, venueId: string, row: Partial<VenueWrite>) {
    const { error } = await this.rls.get().from("event_venues").update(row).eq("id", venueId).eq("partner_id", partnerId);
    throwIfDbError(error, "The venue could not be saved.");
  }
}
