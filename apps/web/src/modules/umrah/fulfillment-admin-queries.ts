import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { ADMIN_PAGE_SIZE, pageRange } from "@/lib/pagination";
import { getBookingTravel } from "@/modules/umrah/itinerary-queries";
import type { PilgrimReadiness } from "@/modules/umrah/readiness";

type UmrahStage = Database["public"]["Enums"]["umrah_fulfillment_stage"];

export const UMRAH_DOCUMENTS_BUCKET = "umrah-documents";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinkedOrder = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  agency_customer?: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
};

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
  order_items(order:order_id(id, order_number, status, total, currency, created_at, agency_customer:agency_customer_id(full_name, phone)))`;

// The payment filter needs the order embed as an inner join, so bookings
// without a matching order drop out; without it, orderless bookings still list.
const LIST_SELECT_BY_PAYMENT = LIST_SELECT.replace(
  "order_items(order:order_id(",
  "order_items!inner(order:order_id!inner("
);

export type UmrahPaymentFilter = "unpaid" | "partial" | "paid" | "closed";

const PAYMENT_STATUSES: Record<UmrahPaymentFilter, Database["public"]["Enums"]["order_status"][]> = {
  unpaid: ["pending_payment", "held"],
  partial: ["partially_paid"],
  paid: ["paid", "processing", "completed"],
  closed: ["cancelled", "refunded"],
};

export async function getUmrahBookingsAdmin(filters: {
  stage?: UmrahStage;
  departureId?: string;
  packageId?: string;
  payment?: UmrahPaymentFilter;
  page?: number;
}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const { from, to } = pageRange(page);
  let query = supabase
    .from("umrah_bookings")
    .select(filters.payment ? (LIST_SELECT_BY_PAYMENT as typeof LIST_SELECT) : LIST_SELECT, { count: "exact" });
  if (filters.stage) query = query.eq("fulfillment_stage", filters.stage);
  if (filters.departureId) query = query.eq("departure_id", filters.departureId);
  if (filters.packageId) query = query.eq("package_id", filters.packageId);
  if (filters.payment) query = query.in("order_items.order.status", PAYMENT_STATUSES[filters.payment]);
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const bookings = (data ?? []).map((b) => {
    const order = latestOrder(b.order_items);
    return {
      ...b,
      total_price: Number(b.total_price),
      customer: one(b.customer),
      agency: one(b.agency),
      package: one(b.package),
      departure: one(b.departure),
      custom_request: one(b.custom_request),
      order,
      guest: one(order?.agency_customer),
    };
  });
  return { bookings, total: count ?? 0, pageSize: ADMIN_PAGE_SIZE };
}

/** Packages and departures for the list filters: every package, departures from 60 days ago on. */
export async function getUmrahFilterOptions() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: packages }, { data: departures }] = await Promise.all([
    supabase.from("umrah_packages").select("id, name").order("name").limit(500),
    supabase
      .from("umrah_package_departures")
      .select("id, departure_date, package:package_id(name)")
      .gte("departure_date", since)
      .order("departure_date")
      .limit(500),
  ]);
  return {
    packages: packages ?? [],
    departures: (departures ?? []).map((d) => ({ ...d, package: one(d.package) })),
  };
}

export async function getUmrahBookingAdmin(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_bookings")
    .select(
      `id, booking_kind, num_pilgrims, total_price, currency, status, fulfillment_stage, room_sharing, special_requests, created_at, custom_request_id,
       customer:profiles!umrah_bookings_customer_id_fkey(full_name, email, phone),
       booker:profiles!umrah_bookings_booked_by_fkey(full_name, email),
       agency:agency_id(name),
       package:package_id(id, name, duration_days),
       departure:departure_id(id, departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at, return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note),
       custom_request:custom_request_id(reference, departure_date, nights_makkah, nights_madinah),
       order_items(order:order_id(id, order_number, status, total, subtotal, markup_amount, currency, created_at, balance_due_at, agency_customer:agency_customer_id(full_name, phone), payments(amount, status))),
       umrah_pilgrims(id, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, passport_issue_country, mahram_name, mahram_relation, phone),
       umrah_booking_stage_history(id, stage, note, created_at, actor:profiles!umrah_booking_stage_history_actor_fkey(full_name, email)),
       umrah_booking_documents(id, pilgrim_id, doc_type, title, storage_path, file_name, file_size, content_type, created_at, source, review_status, review_note)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const documents = [...(data.umrah_booking_documents ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [signed, readinessRows, travel, serviceLines] = await Promise.all([
    Promise.all(
      documents.map(async (doc) => {
        const { data: url } = await supabase.storage.from(UMRAH_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 3600);
        return { ...doc, url: url?.signedUrl ?? null };
      })
    ),
    supabase.rpc("umrah_pilgrim_readiness", { p_booking_id: id }).then(({ data: rows }) => rows ?? []),
    getBookingTravel(supabase, id),
    data.custom_request_id
      ? supabase
          .from("umrah_custom_request_services")
          .select("id, category, name, price_unit, unit_price, quantity, line_total")
          .eq("request_id", data.custom_request_id)
          .order("category")
          .then(({ data: rows }) => rows ?? [])
      : Promise.resolve([]),
  ]);

  const orders = (data.order_items ?? [])
    .map((i) => one(i.order))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const order = orders[0] ?? null;
  const paid = (order?.payments ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const readiness: Record<string, PilgrimReadiness> = Object.fromEntries(
    readinessRows.map((r) => [r.pilgrim_id, { missing: r.missing, warnings: r.warnings }])
  );

  return {
    ...data,
    total_price: Number(data.total_price),
    customer: one(data.customer),
    booker: one(data.booker),
    agency: one(data.agency),
    package: one(data.package),
    departure: one(data.departure),
    custom_request: one(data.custom_request),
    order: order
      ? {
          ...order,
          total: Number(order.total),
          paid,
          balance: Math.max(Number(order.total) - paid, 0),
          guest: one(order.agency_customer),
        }
      : null,
    pilgrims: [...(data.umrah_pilgrims ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    readiness,
    history: [...(data.umrah_booking_stage_history ?? [])]
      .map((h) => ({ ...h, actor: one(h.actor) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    documents: signed.filter((d) => d.source !== "customer"),
    handedIn: signed.filter((d) => d.source === "customer"),
    travel,
    serviceLines,
  };
}
