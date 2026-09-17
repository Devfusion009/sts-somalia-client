import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

type UmrahStage = Database["public"]["Enums"]["umrah_fulfillment_stage"];

export const UMRAH_DOCUMENTS_BUCKET = "umrah-documents";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinkedOrder = { id: string; order_number: string; status: string; total: number; currency: string; created_at: string };

/** Latest order linked through order_items — the same one the stage RPC checks for payment. */
function latestOrder(items: { order: LinkedOrder | LinkedOrder[] | null }[] | null | undefined) {
  const orders = (items ?? []).map((i) => one(i.order)).filter((o): o is LinkedOrder => !!o);
  orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return orders[0] ?? null;
}

const LIST_SELECT = `id, booking_kind, num_pilgrims, total_price, currency, status, fulfillment_stage, room_sharing, created_at,
  customer:profiles!umrah_bookings_customer_id_fkey(full_name, email, phone),
  agency:agency_id(name),
  package:package_id(id, name, duration_days),
  departure:departure_id(id, departure_date, return_date),
  custom_request:custom_request_id(reference, departure_date, nights_makkah, nights_madinah),
  order_items(order:order_id(id, order_number, status, total, currency, created_at))`;

export async function getUmrahBookingsAdmin(stage?: UmrahStage) {
  const supabase = await createClient();
  let query = supabase.from("umrah_bookings").select(LIST_SELECT).order("created_at", { ascending: false });
  if (stage) query = query.eq("fulfillment_stage", stage);
  const { data } = await query;

  return (data ?? []).map((b) => ({
    ...b,
    total_price: Number(b.total_price),
    customer: one(b.customer),
    agency: one(b.agency),
    package: one(b.package),
    departure: one(b.departure),
    custom_request: one(b.custom_request),
    order: latestOrder(b.order_items),
  }));
}

export async function getUmrahBookingAdmin(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_bookings")
    .select(
      `id, booking_kind, num_pilgrims, total_price, currency, status, fulfillment_stage, room_sharing, special_requests, created_at,
       customer:profiles!umrah_bookings_customer_id_fkey(full_name, email, phone),
       agency:agency_id(name),
       package:package_id(id, name, duration_days),
       departure:departure_id(id, departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
       custom_request:custom_request_id(reference, departure_date, nights_makkah, nights_madinah),
       order_items(order:order_id(id, order_number, status, total, currency, created_at)),
       umrah_pilgrims(id, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, mahram_name, mahram_relation),
       umrah_booking_stage_history(id, stage, note, created_at, actor:profiles!umrah_booking_stage_history_actor_fkey(full_name, email)),
       umrah_booking_documents(id, pilgrim_id, doc_type, title, storage_path, file_name, file_size, content_type, created_at)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const documents = [...(data.umrah_booking_documents ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const signed = await Promise.all(
    documents.map(async (doc) => {
      const { data: url } = await supabase.storage.from(UMRAH_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: url?.signedUrl ?? null };
    })
  );

  return {
    ...data,
    total_price: Number(data.total_price),
    customer: one(data.customer),
    agency: one(data.agency),
    package: one(data.package),
    departure: one(data.departure),
    custom_request: one(data.custom_request),
    order: latestOrder(data.order_items),
    pilgrims: data.umrah_pilgrims ?? [],
    history: [...(data.umrah_booking_stage_history ?? [])]
      .map((h) => ({ ...h, actor: one(h.actor) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    documents: signed,
  };
}
