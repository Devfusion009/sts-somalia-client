import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@sts/shared-types";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { throwIfDbError } from "../../../common/errors/db-error";

export const DOCUMENTS_BUCKET = "umrah-documents";
export const ADMIN_PAGE_SIZE = 25;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type PgError = { code?: string; message: string } | null;
type OrderStatus = Database["public"]["Enums"]["order_status"];
export type UmrahStage = Database["public"]["Enums"]["umrah_fulfillment_stage"];

const LIST_SELECT = `id, booking_kind, num_pilgrims, total_price, currency, status, fulfillment_stage, room_sharing, created_at,
  customer:profiles!umrah_bookings_customer_id_fkey(full_name, email, phone),
  agency:agency_id(name),
  package:package_id(id, name, duration_days),
  departure:departure_id(id, departure_date, return_date),
  custom_request:custom_request_id(reference, departure_date, nights_makkah, nights_madinah),
  order_items(order:order_id(id, order_number, status, total, currency, created_at, agency_customer:agency_customer_id(full_name, phone)))`;

// The payment filter needs the order embed as an inner join.
const LIST_SELECT_BY_PAYMENT = LIST_SELECT.replace("order_items(order:order_id(", "order_items!inner(order:order_id!inner(");

const DETAIL_SELECT = `id, booking_kind, num_pilgrims, total_price, currency, status, fulfillment_stage, room_sharing, special_requests, created_at, custom_request_id,
  customer:profiles!umrah_bookings_customer_id_fkey(full_name, email, phone),
  booker:profiles!umrah_bookings_booked_by_fkey(full_name, email),
  agency:agency_id(name),
  package:package_id(id, name, duration_days),
  departure:departure_id(id, departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
  custom_request:custom_request_id(reference, departure_date, nights_makkah, nights_madinah),
  order_items(order:order_id(id, order_number, status, total, subtotal, markup_amount, currency, created_at, balance_due_at, agency_customer:agency_customer_id(full_name, phone), payments(amount, status))),
  umrah_pilgrims(id, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, passport_issue_country, mahram_name, mahram_relation, phone),
  umrah_booking_stage_history(id, stage, note, created_at, actor:profiles!umrah_booking_stage_history_actor_fkey(full_name, email)),
  umrah_booking_documents(id, pilgrim_id, doc_type, title, storage_path, file_name, file_size, content_type, created_at, source, review_status, review_note)`;

/**
 * umrah_bookings and everything recorded against a booking: pilgrims,
 * documents (and their storage objects), travel segments, room assignments,
 * plus the stage / cancel / review RPCs. Every call runs as the caller; the
 * RPCs decide who may do what.
 */
@Injectable()
export class UmrahBookingRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  /** Typed reads: row shapes flow from the generated schema to the API's callers. */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /** Writes take payloads built by the services from validated DTOs. */
  private write(): SupabaseClient {
    return this.rls.get();
  }

  // ---- create ----

  async createGroupBooking(args: Record<string, unknown>): Promise<{ id: string | null; error: PgError }> {
    const { data, error } = await this.write().rpc("create_umrah_group_booking", args);
    return { id: (data as string | null) ?? null, error };
  }

  async insertPrivateBooking(row: Row): Promise<{ id: string | null; error: PgError }> {
    const { data, error } = await this.write().from("umrah_bookings").insert(row).select("id").single();
    return { id: data?.id ?? null, error };
  }

  async findPrice(bookingId: string): Promise<{ id: string; total_price: number; currency: string; booking_kind: string } | null> {
    const { data } = await this.db().from("umrah_bookings").select("id, total_price, currency, booking_kind").eq("id", bookingId).single();
    return data;
  }

  async delete(bookingId: string) {
    await this.write().from("umrah_bookings").delete().eq("id", bookingId);
  }

  async insertPilgrims(bookingId: string, pilgrims: Row[]): Promise<PgError> {
    const { error } = await this.write()
      .from("umrah_pilgrims")
      .insert(pilgrims.map((p) => ({ ...p, booking_id: bookingId })));
    return error;
  }

  // ---- pilgrims and documents ----

  async updatePilgrim(pilgrimId: string, patch: Row): Promise<PgError> {
    const { error } = await this.write().rpc("update_umrah_pilgrim", { p_pilgrim_id: pilgrimId, p_patch: patch });
    return error;
  }

  async findPilgrimOnBooking(pilgrimId: string, bookingId: string): Promise<{ id: string; full_name: string } | null> {
    const { data } = await this.db()
      .from("umrah_pilgrims")
      .select("id, full_name")
      .eq("id", pilgrimId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    return data;
  }

  async findPilgrimIds(bookingId: string): Promise<string[]> {
    const { data } = await this.db().from("umrah_pilgrims").select("id").eq("booking_id", bookingId);
    return (data ?? []).map((p: { id: string }) => p.id);
  }

  async uploadDocument(path: string, body: Buffer, contentType: string): Promise<PgError> {
    const { error } = await this.db().storage.from(DOCUMENTS_BUCKET).upload(path, body, { contentType });
    return error ? { message: error.message } : null;
  }

  async removeStorage(paths: string[]): Promise<PgError> {
    const { error } = await this.db().storage.from(DOCUMENTS_BUCKET).remove(paths);
    return error ? { message: error.message } : null;
  }

  async signDocument(path: string): Promise<string | null> {
    const { data } = await this.db().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  async insertDocument(row: Row): Promise<PgError> {
    const { error } = await this.write().from("umrah_booking_documents").insert(row);
    return error;
  }

  async deletePendingCustomerDocument(documentId: string): Promise<{ storage_path: string } | null> {
    const { data } = await this.write()
      .from("umrah_booking_documents")
      .delete()
      .eq("id", documentId)
      .eq("source", "customer")
      .eq("review_status", "pending")
      .select("storage_path")
      .maybeSingle();
    return data;
  }

  async findDocument(documentId: string): Promise<{ id: string; booking_id: string; storage_path: string } | null> {
    const { data } = await this.db()
      .from("umrah_booking_documents")
      .select("id, booking_id, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    return data;
  }

  async deleteDocumentRow(documentId: string) {
    const { error } = await this.write().from("umrah_booking_documents").delete().eq("id", documentId);
    throwIfDbError(error, "The document could not be removed.");
  }

  async reviewDocument(documentId: string, decision: string, note?: string): Promise<PgError> {
    const { error } = await this.db().rpc("review_umrah_document", {
      p_document_id: documentId,
      p_decision: decision,
      p_note: note || undefined,
    });
    return error;
  }

  // ---- stage, status, cancel ----

  async setStage(bookingId: string, stage: UmrahStage, note?: string): Promise<PgError> {
    const { error } = await this.db().rpc("set_umrah_booking_stage", {
      p_booking_id: bookingId,
      p_stage: stage,
      p_note: note || undefined,
    });
    return error;
  }

  async declinePrivate(bookingId: string, note?: string): Promise<PgError> {
    const { error } = await this.db().rpc("decline_umrah_private_request", { p_booking_id: bookingId, p_note: note || undefined });
    return error;
  }

  async adminCancel(bookingId: string, reason: string, refundAmount?: number): Promise<PgError> {
    const { error } = await this.db().rpc("admin_cancel_umrah_booking", {
      p_booking_id: bookingId,
      p_reason: reason,
      p_refund_amount: refundAmount,
    });
    return error;
  }

  async updateTotalPrice(bookingId: string, price: number) {
    const { error } = await this.write().from("umrah_bookings").update({ total_price: price }).eq("id", bookingId);
    throwIfDbError(error, "The price could not be saved.");
  }

  async findOrderItem(bookingId: string): Promise<{ id: string; order: { id: string; status: string; agency_id: string | null } | null } | null> {
    const { data } = await this.db()
      .from("order_items")
      .select("id, order:order_id (id, status, agency_id)")
      .eq("umrah_booking_id", bookingId)
      .maybeSingle();
    return data as { id: string; order: { id: string; status: string; agency_id: string | null } | null } | null;
  }

  // ---- segments ----

  async upsertSegment(id: string | undefined, row: Row) {
    const { error } = id
      ? await this.write().from("umrah_booking_segments").update(row).eq("id", id).eq("booking_id", row.booking_id)
      : await this.write().from("umrah_booking_segments").insert(row);
    throwIfDbError(error, "The travel detail could not be saved.");
  }

  async deleteSegment(segmentId: string): Promise<string | null> {
    const { data } = await this.write()
      .from("umrah_booking_segments")
      .delete()
      .eq("id", segmentId)
      .select("booking_id")
      .maybeSingle();
    return data?.booking_id ?? null;
  }

  // ---- departures (operations) ----

  async findLiveBookingIds(departureId: string): Promise<string[]> {
    const { data } = await this.db()
      .from("umrah_bookings")
      .select("id")
      .eq("departure_id", departureId)
      .in("status", ["pending", "confirmed"])
      .limit(1000);
    return (data ?? []).map((b: { id: string }) => b.id);
  }

  async findBehindStage(departureId: string, stages: UmrahStage[]) {
    const { data, error } = await this.db()
      .from("umrah_bookings")
      .select("id, fulfillment_stage, order_items(order:order_id(order_number))")
      .eq("departure_id", departureId)
      .in("status", ["pending", "confirmed"])
      .in("fulfillment_stage", stages)
      .limit(1000);
    throwIfDbError(error, "Bookings could not be loaded.");
    return data ?? [];
  }

  async expireUnpaid(): Promise<number> {
    const { data, error } = await this.db().rpc("expire_unpaid_umrah_orders");
    throwIfDbError(error, "Seats could not be released.");
    return Number(data ?? 0);
  }

  async cancelDeparture(departureId: string, reason: string) {
    const { error } = await this.db().rpc("cancel_umrah_departure", { p_departure_id: departureId, p_reason: reason });
    throwIfDbError(error, "The departure could not be cancelled.");
  }

  async departuresOverview(from: string) {
    const { data, error } = await this.db().rpc("umrah_departures_overview", { p_from: from });
    throwIfDbError(error, "Departures could not be loaded.");
    return data ?? [];
  }

  async departureDetail(departureId: string) {
    const [{ data: departure, error }, { data: manifest }, { data: rooms }] = await Promise.all([
      this.db()
        .from("umrah_package_departures")
        .select(
          "id, package_id, departure_date, return_date, total_seats, booked_seats, offline_seats, status, sales_close_days, outbound_airline, outbound_flight_number, return_airline, return_flight_number, package:package_id(id, name, currency)"
        )
        .eq("id", departureId)
        .maybeSingle(),
      this.db().rpc("umrah_departure_manifest", { p_departure_id: departureId }),
      this.db()
        .from("umrah_room_assignments")
        .select("id, city, room_label, capacity, gender, umrah_room_occupants(pilgrim_id)")
        .eq("departure_id", departureId)
        .order("city")
        .order("room_label"),
    ]);
    throwIfDbError(error, "The departure could not be loaded.");
    return { departure, manifest: manifest ?? [], rooms: rooms ?? [] };
  }

  async insertRoom(row: Row): Promise<PgError> {
    const { error } = await this.write().from("umrah_room_assignments").insert(row);
    return error;
  }

  async deleteRoom(roomId: string): Promise<string | null> {
    const { data, error } = await this.write()
      .from("umrah_room_assignments")
      .delete()
      .eq("id", roomId)
      .select("departure_id")
      .maybeSingle();
    throwIfDbError(error, "The room could not be removed.");
    return data?.departure_id ?? null;
  }

  async findRoom(roomId: string): Promise<{ id: string; departure_id: string } | null> {
    const { data } = await this.db().from("umrah_room_assignments").select("id, departure_id").eq("id", roomId).maybeSingle();
    return data;
  }

  async insertOccupants(roomId: string, pilgrimIds: string[]): Promise<PgError> {
    const { error } = await this.write()
      .from("umrah_room_occupants")
      .insert(pilgrimIds.map((pilgrim_id) => ({ room_id: roomId, pilgrim_id })));
    return error;
  }

  async deleteOccupant(roomId: string, pilgrimId: string) {
    const { error } = await this.write().from("umrah_room_occupants").delete().eq("room_id", roomId).eq("pilgrim_id", pilgrimId);
    throwIfDbError(error, "The room could not be updated.");
  }

  // ---- admin reads ----

  async list(filters: { stage?: UmrahStage; departureId?: string; packageId?: string; paymentStatuses?: OrderStatus[]; page: number }) {
    const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
    let query = this.db()
      .from("umrah_bookings")
      .select((filters.paymentStatuses ? LIST_SELECT_BY_PAYMENT : LIST_SELECT) as typeof LIST_SELECT, { count: "exact" });
    if (filters.stage) query = query.eq("fulfillment_stage", filters.stage);
    if (filters.departureId) query = query.eq("departure_id", filters.departureId);
    if (filters.packageId) query = query.eq("package_id", filters.packageId);
    if (filters.paymentStatuses) query = query.in("order_items.order.status", filters.paymentStatuses);
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + ADMIN_PAGE_SIZE - 1);
    throwIfDbError(error, "Bookings could not be loaded.");
    return { rows: data ?? [], total: count ?? 0 };
  }

  async filterOptions(since: string) {
    const [{ data: packages }, { data: departures }] = await Promise.all([
      this.db().from("umrah_packages").select("id, name").order("name").limit(500),
      this.db()
        .from("umrah_package_departures")
        .select("id, departure_date, package:package_id(name)")
        .gte("departure_date", since)
        .order("departure_date")
        .limit(500),
    ]);
    return { packages: packages ?? [], departures: departures ?? [] };
  }

  async detail(bookingId: string) {
    const { data, error } = await this.db().from("umrah_bookings").select(DETAIL_SELECT).eq("id", bookingId).maybeSingle();
    throwIfDbError(error, "The booking could not be loaded.");
    return data;
  }

  async readiness(bookingId: string): Promise<{ pilgrim_id: string; missing: string[]; warnings: string[] }[]> {
    const { data } = await this.db().rpc("umrah_pilgrim_readiness", { p_booking_id: bookingId });
    return data ?? [];
  }

  // ---- traveller view (customer, agent, admin; RLS-scoped) ----

  async pilgrims(bookingId: string) {
    const { data, error } = await this.db()
      .from("umrah_pilgrims")
      .select(
        "id, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, passport_issue_country, mahram_name, mahram_relation, phone"
      )
      .eq("booking_id", bookingId)
      .order("full_name");
    throwIfDbError(error, "Pilgrims could not be loaded.");
    return data ?? [];
  }

  async history(bookingId: string) {
    const { data } = await this.db()
      .from("umrah_booking_stage_history")
      .select("id, stage, note, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async documents(bookingId: string) {
    const { data } = await this.db()
      .from("umrah_booking_documents")
      .select("id, pilgrim_id, doc_type, title, storage_path, file_name, file_size, created_at, source, review_status, review_note")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  /** Private bucket: links expire after an hour. */
  async signDocuments(paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data } = await this.db().storage.from(DOCUMENTS_BUCKET).createSignedUrls(paths, 3600);
    for (const entry of data ?? []) if (entry.path && entry.signedUrl) out.set(entry.path, entry.signedUrl);
    return out;
  }

  // ---- travel (customer, agent, admin; RLS-scoped) ----

  async travelBase(bookingId: string) {
    const { data } = await this.db()
      .from("umrah_bookings")
      .select(
        `id, booking_kind, package_id, custom_request_id,
         package:package_id(duration_days, contact_person_name, contact_person_phone, contact_person_email, contact_whatsapp),
         departure:departure_id(departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
           return_airline, return_flight_number, return_departs_at, return_arrives_at),
         custom_request:custom_request_id(departure_date, nights_makkah, nights_madinah, package_snapshot)`
      )
      .eq("id", bookingId)
      .maybeSingle();
    return data;
  }

  async packageHotels(packageId: string) {
    const { data } = await this.db()
      .from("umrah_package_hotels")
      .select("city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order")
      .eq("package_id", packageId)
      .order("sort_order");
    return data ?? [];
  }

  async packageDays(packageId: string) {
    const { data } = await this.db()
      .from("umrah_itinerary_days")
      .select("day_number, title, description")
      .eq("package_id", packageId)
      .order("day_number");
    return data ?? [];
  }

  async segments(bookingId: string) {
    const { data } = await this.db()
      .from("umrah_booking_segments")
      .select("id, kind, title, provider, reference, starts_at, ends_at, city, notes")
      .eq("booking_id", bookingId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("sort_order");
    return data ?? [];
  }
}
