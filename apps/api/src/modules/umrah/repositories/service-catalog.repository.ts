import { Injectable } from "@nestjs/common";
import type { Database } from "@sts/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toSharingPriceMap, type SharingPriceMap, type UmrahService } from "@sts/shared-types";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { throwIfDbError } from "../../../common/errors/db-error";

const SERVICE_SELECT =
  "id, category, name, description, tier, price, currency, price_unit, star_rating, distance_to_haram_m, is_default, sort_order";

/** umrah_services and their occupancy prices (umrah_service_sharing_prices). */
@Injectable()
export class ServiceCatalogRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  /** Typed reads: row shapes flow from the generated schema to the API's callers. */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /** Public catalog reads work signed out too. */
  private publicDb(): SupabaseClient<Database> {
    return this.rls.getOrAnon() as SupabaseClient<Database>;
  }

  /** Writes take payloads built by the services from validated DTOs. */
  private write(): SupabaseClient {
    return this.rls.get();
  }

  async findPublished(): Promise<UmrahService[]> {
    const { data, error } = await this.publicDb()
      .from("umrah_services")
      .select(SERVICE_SELECT)
      .eq("status", "published")
      .order("category")
      .order("sort_order");
    throwIfDbError(error, "Services could not be loaded.");
    return (data ?? []).map((s: UmrahService) => ({ ...s, price: Number(s.price) }));
  }

  async findPublishedByIds(ids: string[]): Promise<UmrahService[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db().from("umrah_services").select(SERVICE_SELECT).in("id", ids).eq("status", "published");
    throwIfDbError(error, "Services could not be loaded.");
    return (data ?? []).map((s: UmrahService) => ({ ...s, price: Number(s.price) }));
  }

  /** Occupancy prices for published hotel services. */
  async findPublishedSharingPrices(): Promise<SharingPriceMap> {
    const { data, error } = await this.publicDb()
      .from("umrah_service_sharing_prices")
      .select("service_id, sharing, price, service:umrah_services!inner(status, category)")
      .eq("service.status", "published")
      .in("service.category", ["hotel_makkah", "hotel_madinah"]);
    throwIfDbError(error, "Prices could not be loaded.");
    return toSharingPriceMap(data ?? []);
  }

  async findSharingPrices(serviceIds: string[]): Promise<SharingPriceMap> {
    if (serviceIds.length === 0) return {};
    const { data, error } = await this.db()
      .from("umrah_service_sharing_prices")
      .select("service_id, sharing, price")
      .in("service_id", serviceIds);
    throwIfDbError(error, "Prices could not be loaded.");
    return toSharingPriceMap(data ?? []);
  }

  async findAllAdmin() {
    const { data, error } = await this.db()
      .from("umrah_services")
      .select(`${SERVICE_SELECT}, status, sharing_prices:umrah_service_sharing_prices(sharing, price)`)
      .order("category")
      .order("sort_order");
    throwIfDbError(error, "Services could not be loaded.");
    return (data ?? []).map((s: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      ...s,
      price: Number(s.price),
      sharing_prices: (s.sharing_prices ?? []).map((p: { sharing: number; price: number | string }) => ({
        sharing: p.sharing,
        price: Number(p.price),
      })),
    }));
  }

  /** Returns "duplicate_default" when the one-default-per-(category, tier) index refuses it. */
  async save(id: string | undefined, row: Record<string, unknown>): Promise<string | "duplicate_default"> {
    const { data, error } = id
      ? await this.write().from("umrah_services").update(row).eq("id", id).select("id").single()
      : await this.write().from("umrah_services").insert(row).select("id").single();
    if (error?.code === "23505") return "duplicate_default";
    throwIfDbError(error, "The service could not be saved.");
    return (data as { id: string }).id;
  }

  async saveSharingPrices(serviceId: string, prices: { sharing: number; price: number | null }[]) {
    const upserts = prices
      .filter((p): p is { sharing: number; price: number } => p.price !== null)
      .map((p) => ({ service_id: serviceId, sharing: p.sharing, price: p.price }));
    const cleared = prices.filter((p) => p.price === null).map((p) => p.sharing);
    if (upserts.length) {
      const { error } = await this.write().from("umrah_service_sharing_prices").upsert(upserts, { onConflict: "service_id,sharing" });
      throwIfDbError(error, "Room prices could not be saved.");
    }
    if (cleared.length) {
      const { error } = await this.write()
        .from("umrah_service_sharing_prices")
        .delete()
        .eq("service_id", serviceId)
        .in("sharing", cleared);
      throwIfDbError(error, "Room prices could not be saved.");
    }
  }

  /** Requests that chose it keep their snapshotted line (service_id set null). */
  async delete(serviceId: string) {
    const { error } = await this.write().from("umrah_services").delete().eq("id", serviceId);
    throwIfDbError(error, "The service could not be removed.");
  }
}
