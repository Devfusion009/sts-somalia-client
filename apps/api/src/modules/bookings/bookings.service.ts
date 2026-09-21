import { Injectable, NotFoundException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { Database, OpenBookingRequestInput, BookingType, UnifiedBooking } from "@sts/shared-types";

const ORDER_ITEM_FK: Record<BookingType, string> = {
  hotel: "hotel_booking_id",
  flight: "flight_booking_id",
  visa: "visa_application_id",
  umrah: "umrah_booking_id",
  hall: "hall_booking_id",
};

function visaArrivalDate(travelDetails: unknown): string | null {
  if (!travelDetails || typeof travelDetails !== "object") return null;
  const value = (travelDetails as Record<string, unknown>).arrivalDate;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type MyBookingsResult = {
  bookings: UnifiedBooking[];
  orderMeta: Record<string, { orderNumber: string | null; total: number; currency: string }>;
};

/**
 * Direct port of apps/web's modules/bookings/{queries,actions}.ts. Reads
 * hotel/flight/visa/umrah/hall booking tables directly (not through those
 * verticals' own modules, which is why this module has no cross-module
 * dependency and migrates cleanly, unlike invoicing/VoucherDocument which
 * depend on payments/queries.ts's helpers).
 */
@Injectable()
export class BookingsService {
  constructor(private readonly rls: RlsSupabaseService) {}

  /**
   * Cast locally, not globally on RlsSupabaseService — see the comment on
   * that class. This module's joined selects (orders!inner(...),
   * hotels(name), etc.) genuinely need Database's relationship typing;
   * other modules don't, and inheriting it globally tripped TS2589.
   */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /**
   * Every booking belonging to the caller across all five verticals,
   * normalised into one shape and annotated with its order. Returns
   * orderMeta as a plain object, not a Map — no superjson transformer on
   * this tRPC setup, same reasoning as PreferencesService.getFxRates.
   *
   * `personalOnly` drops the `booked_by` side of the match — an agent's
   * `booked_by` is set on every order they process for their agency's
   * customers too, so the plain `customer_id`-only filter is what actually
   * isolates "bookings where I am the traveller" from "bookings I booked
   * for someone else." Used by the agent portal's own read-only history of
   * orders from before the account became an agent.
   */
  async getMyBookings(userId: string, opts: { personalOnly?: boolean } = {}): Promise<MyBookingsResult> {
    const supabase = this.db();
    const orFilter = opts.personalOnly
      ? `customer_id.eq.${userId}`
      : `customer_id.eq.${userId},booked_by.eq.${userId}`;
    const visaOrFilter = opts.personalOnly
      ? `applicant_profile_id.eq.${userId}`
      : `applicant_profile_id.eq.${userId},submitted_by.eq.${userId}`;

    const [hotelRes, flightRes, visaRes, umrahRes, umrahDraftRes, hallRes, orderItemsRes] = await Promise.all([
      supabase
        .from("hotel_bookings")
        .select("id, check_in, check_out, status, total_price, currency, created_at, hotels(name)")
        .or(orFilter),
      supabase
        .from("flight_bookings")
        .select("id, origin_iata, destination_iata, depart_at, status, total_price, currency, created_at")
        .or(orFilter),
      supabase
        .from("visa_applications")
        .select("id, status, price, currency, created_at, travel_details, visa_types(name)")
        .or(visaOrFilter),
      supabase
        .from("umrah_bookings")
        .select(
          "id, status, total_price, currency, created_at, num_pilgrims, booking_kind, umrah_packages(name), umrah_package_departures(departure_date, return_date), umrah_custom_requests(reference, departure_date)"
        )
        .or(orFilter),
      supabase
        .from("umrah_custom_requests")
        .select("id, reference, status, current_step, num_pilgrims, departure_date, subtotal, currency, created_at")
        .eq("status", "draft")
        .or(orFilter),
      supabase
        .from("hall_bookings")
        .select("id, event_type, start_date, end_date, status, price, currency, created_at, event_venues(name)")
        .or(orFilter),
      supabase
        .from("order_items")
        .select(
          "order_id, hotel_booking_id, flight_booking_id, visa_application_id, umrah_booking_id, hall_booking_id, orders!inner(order_number, status, total, currency, customer_id, booked_by)"
        )
        .or(orFilter, { referencedTable: "orders" }),
    ]);

    const orderByBooking = new Map<string, { orderId: string; status: string }>();
    const orderMeta: MyBookingsResult["orderMeta"] = {};

    for (const item of orderItemsRes.data ?? []) {
      const matches = opts.personalOnly
        ? item.orders.customer_id === userId
        : item.orders.customer_id === userId || item.orders.booked_by === userId;
      if (!matches) continue;

      orderMeta[item.order_id] = {
        orderNumber: item.orders.order_number,
        total: item.orders.total,
        currency: item.orders.currency,
      };

      for (const [type, fk] of Object.entries(ORDER_ITEM_FK)) {
        const bookingId = (item as unknown as Record<string, string | null>)[fk];
        if (!bookingId) continue;
        orderByBooking.set(`${type}-${bookingId}`, { orderId: item.order_id, status: item.orders.status });
      }
    }

    const link = (type: BookingType, id: string) => {
      const order = orderByBooking.get(`${type}-${id}`);
      return { orderId: order?.orderId ?? null, orderStatus: order?.status ?? null };
    };

    const bookings: UnifiedBooking[] = [
      ...(hotelRes.data ?? []).map((b) => ({
        id: b.id,
        type: "hotel" as const,
        title: b.hotels?.name ?? "Hotel booking",
        subtitle: `${b.check_in} → ${b.check_out}`,
        status: b.status,
        price: b.total_price,
        currency: b.currency,
        createdAt: b.created_at,
        travelDate: b.check_in,
        ...link("hotel", b.id),
      })),
      ...(flightRes.data ?? []).map((b) => ({
        id: b.id,
        type: "flight" as const,
        title: `${b.origin_iata} → ${b.destination_iata}`,
        subtitle: new Date(b.depart_at).toLocaleDateString(),
        status: b.status,
        price: b.total_price,
        currency: b.currency,
        createdAt: b.created_at,
        travelDate: b.depart_at,
        ...link("flight", b.id),
      })),
      ...(visaRes.data ?? []).map((v) => ({
        id: v.id,
        type: "visa" as const,
        title: v.visa_types?.name ?? "Visa application",
        subtitle: "Application",
        status: v.status,
        price: v.price,
        currency: v.currency,
        createdAt: v.created_at,
        travelDate: visaArrivalDate(v.travel_details),
        ...link("visa", v.id),
      })),
      ...(umrahRes.data ?? []).map((u) => ({
        id: u.id,
        type: "umrah" as const,
        title: u.booking_kind === "private" ? "Private Umrah" : (u.umrah_packages?.name ?? "Umrah booking"),
        subtitle:
          u.booking_kind === "private" && u.umrah_custom_requests
            ? `${u.umrah_custom_requests.reference} · ${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`
            : `${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`,
        status: u.status,
        price: u.total_price,
        currency: u.currency,
        createdAt: u.created_at,
        travelDate: u.umrah_package_departures?.departure_date ?? u.umrah_custom_requests?.departure_date ?? null,
        ...link("umrah", u.id),
      })),
      ...(umrahDraftRes.data ?? []).map((r) => ({
        id: r.id,
        type: "umrah" as const,
        title: "Private Umrah",
        subtitle: `${r.reference} · ${r.num_pilgrims} traveller${r.num_pilgrims > 1 ? "s" : ""} · step ${r.current_step} of 4`,
        status: "draft",
        price: Number(r.subtotal),
        currency: r.currency,
        createdAt: r.created_at,
        travelDate: r.departure_date,
        orderId: null,
        orderStatus: null,
      })),
      ...(hallRes.data ?? []).map((h) => ({
        id: h.id,
        type: "hall" as const,
        title: h.event_venues?.name ?? "Hall booking",
        subtitle: `${h.event_type.replace(/_/g, " ")} · ${h.start_date}${h.end_date !== h.start_date ? ` → ${h.end_date}` : ""}`,
        status: h.status,
        price: h.price,
        currency: h.currency,
        createdAt: h.created_at,
        travelDate: h.start_date,
        ...link("hall", h.id),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { bookings, orderMeta };
  }

  async getBookingRequests(orderId: string) {
    const { data } = await this.db()
      .from("booking_requests")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async getMyBookingRequests(userId: string) {
    const { data } = await this.db()
      .from("booking_requests")
      .select("*, orders(order_number, status)")
      .eq("requested_by", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  /**
   * Deliberately does NOT mutate the order — once money has moved, whether a
   * booking can be cancelled is governed by supplier fare rules, not this
   * form. cancel_order() (phase 3) still handles the pre-payment case
   * directly. Direct port, unchanged logic.
   */
  async openBookingRequest(userId: string, input: OpenBookingRequestInput) {
    const supabase = this.db();

    const { data: order } = await supabase
      .from("orders")
      .select("id, currency, status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (!order) throw new NotFoundException("That order could not be found.");

    const { data: existing } = await supabase
      .from("booking_requests")
      .select("id")
      .eq("order_id", order.id)
      .eq("kind", input.kind)
      .in("status", ["requested", "in_review"])
      .maybeSingle();
    if (existing) {
      throw new Error("You already have an open request of this type for this booking.");
    }

    const { error } = await supabase.from("booking_requests").insert({
      order_id: order.id,
      requested_by: userId,
      kind: input.kind,
      reason: input.reason,
      requested_amount: input.requestedAmount ?? null,
      currency: order.currency,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  async withdrawBookingRequest(userId: string, requestId: string) {
    await this.rls
      .get()
      .from("booking_requests")
      .update({ status: "withdrawn" })
      .eq("id", requestId)
      .eq("requested_by", userId)
      .in("status", ["requested", "in_review"]);
    return { ok: true as const };
  }
}
