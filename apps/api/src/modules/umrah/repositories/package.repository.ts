import { RedisService } from "../../../infra/redis/redis.service";
import { Injectable } from "@nestjs/common";
import type { Database } from "@sts/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { createAnonClient } from "../../../infra/supabase/supabase-clients";
import { dbException, throwIfDbError } from "../../../common/errors/db-error";

export const IMAGES_BUCKET = "umrah-images";

const CARD_SELECT =
  "id, package_type, slug, name, tagline, tier, is_featured, origin_iata, destination_iata, duration_days, base_price, original_price, currency, includes, images, umrah_package_departures(departure_date, total_seats, booked_seats, offline_seats, sales_close_days, status), umrah_package_hotels(city, name, star_rating, distance_to_haram_m)";

const DETAIL_SELECT = `id, package_type, slug, name, description, tagline, tier, is_featured, origin_iata, destination_iata,
  duration_days, includes, images, base_price, original_price, currency, status,
  agent_contacts, facilities, accommodation_details, flight_details, transport_details, nights_makkah, nights_madinah,
  meal_plan, meals_note, contact_person_name, contact_person_phone, contact_person_email, contact_whatsapp,
  umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, offline_seats, price_override, sales_close_days, status,
    outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
    return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
  umrah_package_hotels(id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order),
  umrah_itinerary_days(id, day_number, title, description),
  umrah_package_pricing(id, sharing, price)`;

const DEPARTURE_FLIGHT_COLUMNS =
  "price_override, departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at";

// Rows from these tables are passed through as plain records; the service and
// the output DTOs give them their shape.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** umrah_packages and the tables that hang off a package (departures, hotels, days, rate card, agencies). */
@Injectable()
export class PackageRepository {
  constructor(private readonly rls: RlsSupabaseService, private readonly cache: RedisService) {}

  /** Typed reads: row shapes flow from the generated schema to the API's callers. */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /** Writes take payloads built by the services from validated DTOs. */
  private write(): SupabaseClient {
    return this.rls.get();
  }

  // ---- public catalog (anon, published only) ----

  async findPublishedCards(opts: { featuredFirst: boolean; limit?: number }) {
    const client = createAnonClient();
    const { error: releaseError } = await client.rpc("release_public_umrah_checkouts");
    throwIfDbError(releaseError, "Seat availability could not be checked.");
    let query = client.from("umrah_packages").select(CARD_SELECT).eq("status", "published").eq("pool_visibility", "public")
      .or("package_type.eq.private,public_setup_complete.eq.true");
    query = opts.featuredFirst
      ? query.order("is_featured", { ascending: false }).order("base_price", { ascending: true })
      : query.order("base_price");
    // Limit after availability filtering; sold-out rows must not crowd out seats on sale.
    const { data, error } = await query;
    throwIfDbError(error, "Packages could not be loaded.");
    return data ?? [];
  }

  async findIdBySlug(slug: string): Promise<string | null> {
    const { data } = await this.rls.getOrAnon().from("umrah_packages").select("id").eq("slug", slug).maybeSingle();
    return data?.id ?? null;
  }

  /** Lazy backstop for the unpaid-seat sweep before seat counts are read. */
  async releaseStaleSeats(packageId: string) {
    const client = createAnonClient();
    const { error } = await client.rpc("release_public_umrah_checkouts");
    throwIfDbError(error, "Seat availability could not be checked.");
    await client.rpc("release_stale_umrah_seats", { p_package_id: packageId });
  }

  async findPublishedDetail(slug: string) {
    const { data, error } = await this.rls.getOrAnon().from("umrah_packages").select(DETAIL_SELECT)
      .eq("slug", slug).eq("status", "published")
      .or("package_type.eq.private,public_setup_complete.eq.true").maybeSingle();
    throwIfDbError(error, "The package could not be loaded.");
    return data;
  }

  async findAssignedCards() {
    const { error: releaseError } = await this.rls.get().rpc("release_public_umrah_checkouts");
    throwIfDbError(releaseError, "Seat availability could not be checked.");
    const { data, error } = await this.rls.get().from("umrah_packages").select(CARD_SELECT)
      .eq("status", "published").eq("pool_visibility", "private");
    throwIfDbError(error, "Agency pools could not be loaded.");
    return data ?? [];
  }

  // ---- admin ----

  async findAllAdmin() {
    const { data, error } = await this.db()
      .from("umrah_packages")
      .select("*, umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, price_override)")
      .order("created_at", { ascending: false });
    throwIfDbError(error, "Packages could not be loaded.");
    return data ?? [];
  }

  async findByIdAdmin(id: string) {
    const { data, error } = await this.db()
      .from("umrah_packages")
      .select(
        `*,
         umrah_package_departures(id, departure_date, return_date, total_seats, booked_seats, offline_seats, price_override, sales_close_days, status, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
         umrah_package_hotels(id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order),
         umrah_itinerary_days(id, day_number, title, description),
         umrah_package_pricing(id, sharing, price),
         umrah_package_agencies(agency_id)`
      )
      .eq("id", id)
      .maybeSingle();
    throwIfDbError(error, "The package could not be loaded.");
    return data;
  }

  async insertPublicPackage(row: Row, departureDate: string, totalSeats: number) {
    const { data, error } = await this.write().rpc("create_public_umrah_package", {
      p_package: row, p_departure_date: departureDate, p_total_seats: totalSeats,
    });
    throwIfDbError(error, "The package could not be saved.");
    await this.cache.invalidate("umrah-packages");
    return data as string;
  }

  async insertPackage(row: Row) {
    const { data, error } = await this.write().from("umrah_packages").insert(row).select("id").single();
    throwIfDbError(error, "The package could not be saved.");
    await this.cache.invalidate("umrah-packages");
    return data!.id as string;
  }

  async updatePackage(id: string, row: Row) {
    const { error } = await this.write().from("umrah_packages").update(row).eq("id", id);
    throwIfDbError(error, "The package could not be saved.");
    await this.cache.invalidate("umrah-packages");
  }

  async findImages(packageId: string): Promise<unknown | undefined> {
    const { data, error } = await this.db().from("umrah_packages").select("images").eq("id", packageId).maybeSingle();
    throwIfDbError(error, "The package could not be loaded.");
    return data ? data.images : undefined;
  }

  async setImages(packageId: string, images: string[]) {
    const { error } = await this.write().from("umrah_packages").update({ images }).eq("id", packageId);
    throwIfDbError(error, "The gallery could not be saved.");
    await this.cache.invalidate("umrah-packages");
  }

  async signImageUpload(path: string) {
    const { data, error } = await this.db().storage.from(IMAGES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw dbException({ message: error?.message ?? "no url" }, "Upload could not be started.");
    return { path: data.path, signedUrl: data.signedUrl };
  }

  async imageExists(path: string) {
    const { data } = await this.db().storage.from(IMAGES_BUCKET).exists(path);
    return Boolean(data);
  }

  async removeImages(paths: string[]) {
    await this.db().storage.from(IMAGES_BUCKET).remove(paths);
  }

  // hotels / days / rate card / agencies

  async upsertHotel(id: string | undefined, row: Row) {
    const { error } = id
      ? await this.write().from("umrah_package_hotels").update(row).eq("id", id).eq("package_id", row.package_id)
      : await this.write().from("umrah_package_hotels").insert(row);
    throwIfDbError(error, "The hotel could not be saved.");
  }

  async deleteHotel(packageId: string, id: string) {
    const { error } = await this.write().from("umrah_package_hotels").delete().eq("id", id).eq("package_id", packageId);
    throwIfDbError(error, "The hotel could not be removed.");
  }

  /** Returns false when the day number is already taken. */
  async upsertItineraryDay(id: string | undefined, row: Row): Promise<boolean> {
    const { error } = id
      ? await this.write().from("umrah_itinerary_days").update(row).eq("id", id).eq("package_id", row.package_id)
      : await this.write().from("umrah_itinerary_days").insert(row);
    if (error?.code === "23505") return false;
    throwIfDbError(error, "The day could not be saved.");
    return true;
  }

  async deleteItineraryDay(packageId: string, id: string) {
    const { error } = await this.write().from("umrah_itinerary_days").delete().eq("id", id).eq("package_id", packageId);
    throwIfDbError(error, "The day could not be removed.");
  }

  async upsertPricing(packageId: string, sharing: number, price: number) {
    const { error } = await this.write()
      .from("umrah_package_pricing")
      .upsert({ package_id: packageId, sharing, price }, { onConflict: "package_id,sharing" });
    throwIfDbError(error, "The rate could not be saved.");
  }

  async deletePricing(packageId: string, id: string) {
    const { error } = await this.write().from("umrah_package_pricing").delete().eq("id", id).eq("package_id", packageId);
    throwIfDbError(error, "The rate could not be removed.");
  }

  async findPricingPrices(packageId: string): Promise<number[]> {
    const { data, error } = await this.db().from("umrah_package_pricing").select("price").eq("package_id", packageId);
    throwIfDbError(error, "The rate card could not be loaded.");
    return (data ?? []).map((r: { price: number | string }) => Number(r.price));
  }

  async replaceAgencies(packageId: string, agencyIds: string[]) {
    const { error: delError } = await this.write().from("umrah_package_agencies").delete().eq("package_id", packageId);
    throwIfDbError(delError, "Agencies could not be saved.");
    if (agencyIds.length === 0) return;
    const { error } = await this.write()
      .from("umrah_package_agencies")
      .insert(agencyIds.map((agency_id) => ({ package_id: packageId, agency_id })));
    throwIfDbError(error, "Agencies could not be saved.");
  }

  // departures

  async insertDeparture(row: Row) {
    const { error } = await this.write().from("umrah_package_departures").insert(row);
    return error;
  }

  async findDepartureFlights(departureId: string) {
    const { data, error } = await this.db()
      .from("umrah_package_departures")
      .select(DEPARTURE_FLIGHT_COLUMNS)
      .eq("id", departureId)
      .maybeSingle();
    throwIfDbError(error, "The departure could not be loaded.");
    return data;
  }

  async updateDeparture(departureId: string, packageId: string, row: Row) {
    const { data, error } = await this.write()
      .from("umrah_package_departures")
      .update(row)
      .eq("id", departureId)
      .eq("package_id", packageId)
      .select("id");
    return { updated: (data ?? []).length > 0, error };
  }

  async findDepartureForDelete(departureId: string): Promise<{ id: string; package_id: string; booked_seats: number } | null> {
    const { data, error } = await this.db()
      .from("umrah_package_departures")
      .select("id, package_id, booked_seats")
      .eq("id", departureId)
      .maybeSingle();
    throwIfDbError(error, "The departure could not be loaded.");
    return data;
  }

  async deleteDeparture(departureId: string) {
    const { error } = await this.write().from("umrah_package_departures").delete().eq("id", departureId);
    return error;
  }
}
