import { Injectable } from "@nestjs/common";
import type { Database } from "@sts/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { throwIfDbError } from "../../../common/errors/db-error";

const REQUEST_SELECT = `package_snapshot, id, reference, status, current_step, tier, num_pilgrims, room_sharing, departure_date,
  nights_makkah, nights_madinah, notes, pilgrims, subtotal, currency, customer_id, booked_by,
  agency_id, created_at,
  services:umrah_custom_request_services(id, service_id, category, name, price_unit, unit_price, quantity, line_total)`;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function normalise(r: Row): Row {
  return {
    ...r,
    subtotal: Number(r.subtotal),
    services: (r.services ?? []).map((s: Row) => ({ ...s, unit_price: Number(s.unit_price), line_total: Number(s.line_total) })),
  };
}

/** umrah_custom_requests (private trip drafts) and their chosen service lines. */
@Injectable()
export class CustomRequestRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  /** Typed reads: row shapes flow from the generated schema to the API's callers. */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /** Writes take payloads built by the services from validated DTOs. */
  private write(): SupabaseClient {
    return this.rls.get();
  }

  async findLatestDraft(profileId: string) {
    const { data, error } = await this.db()
      .from("umrah_custom_requests")
      .select(
        "id, reference, current_step, tier, num_pilgrims, departure_date, nights_makkah, nights_madinah, subtotal, currency, updated_at"
      )
      .eq("booked_by", profileId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfDbError(error, "Your trip could not be loaded.");
    return data ? { ...data, subtotal: Number(data.subtotal) } : null;
  }

  async create(row: Row): Promise<string> {
    const { data, error } = await this.write().from("umrah_custom_requests").insert(row).select("id").single();
    throwIfDbError(error, "The trip could not be started.");
    return (data as { id: string }).id;
  }

  /** Mine, and still an editable draft. */
  async findEditable(requestId: string, profileId: string) {
    const { data, error } = await this.db()
      .from("umrah_custom_requests")
      .select("*")
      .eq("id", requestId)
      .eq("booked_by", profileId)
      .eq("status", "draft")
      .maybeSingle();
    throwIfDbError(error, "Your trip could not be loaded.");
    return data;
  }

  async findOne(requestId: string) {
    const { data, error } = await this.db().from("umrah_custom_requests").select(REQUEST_SELECT).eq("id", requestId).maybeSingle();
    throwIfDbError(error, "The trip could not be loaded.");
    return data ? normalise(data) : null;
  }

  async findSubmitted() {
    const { data, error } = await this.db()
      .from("umrah_custom_requests")
      .select(
        `${REQUEST_SELECT}, customer:profiles!umrah_custom_requests_customer_id_fkey(full_name, email, phone),
         booking:umrah_bookings!umrah_bookings_custom_request_id_fkey(id, status, total_price, currency)`
      )
      .eq("status", "submitted")
      .order("created_at", { ascending: false });
    throwIfDbError(error, "Requests could not be loaded.");
    return (data ?? []).map(normalise);
  }

  async update(requestId: string, row: Row) {
    const { error } = await this.write().from("umrah_custom_requests").update(row).eq("id", requestId);
    throwIfDbError(error, "Your trip could not be saved.");
  }

  async discard(requestId: string, profileId: string) {
    const { error } = await this.write()
      .from("umrah_custom_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("booked_by", profileId)
      .eq("status", "draft");
    throwIfDbError(error, "The trip could not be discarded.");
  }

  async findLines(requestId: string) {
    const { data, error } = await this.db()
      .from("umrah_custom_request_services")
      .select("id, service_id, category, name, price_unit, unit_price, service:umrah_services(price, name, status)")
      .eq("request_id", requestId);
    throwIfDbError(error, "Your services could not be loaded.");
    return data ?? [];
  }

  async replaceLines(requestId: string, lines: Row[]) {
    const { error: deleteError } = await this.write().from("umrah_custom_request_services").delete().eq("request_id", requestId);
    throwIfDbError(deleteError, "Your services could not be saved.");
    if (!lines.length) return;
    const { error } = await this.write()
      .from("umrah_custom_request_services")
      .insert(lines.map((l) => ({ ...l, request_id: requestId })));
    throwIfDbError(error, "Your services could not be saved.");
  }

  async updateLine(lineId: string, row: Row) {
    const { error } = await this.write().from("umrah_custom_request_services").update(row).eq("id", lineId);
    throwIfDbError(error, "Your services could not be saved.");
  }

  async deleteLine(lineId: string) {
    const { error } = await this.write().from("umrah_custom_request_services").delete().eq("id", lineId);
    throwIfDbError(error, "Your services could not be saved.");
  }

  async findHotelLines(requestId: string): Promise<{ category: string; name: string }[]> {
    const { data } = await this.db()
      .from("umrah_custom_request_services")
      .select("category, name")
      .eq("request_id", requestId)
      .in("category", ["hotel_makkah", "hotel_madinah"]);
    return data ?? [];
  }

  async findLinesForAdmin(requestId: string) {
    const { data } = await this.db()
      .from("umrah_custom_request_services")
      .select("id, category, name, price_unit, unit_price, quantity, line_total")
      .eq("request_id", requestId)
      .order("category");
    return data ?? [];
  }
}
