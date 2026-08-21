import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { BookingType, UnifiedBooking } from "./types";

const ORDER_ITEM_FK: Record<BookingType, string> = {
  hotel: "hotel_booking_id",
  flight: "flight_booking_id",
  visa: "visa_application_id",
  umrah: "umrah_booking_id",
  hall: "hall_booking_id",
};

/** Pulls an ISO date out of visa_applications.travel_details without trusting its shape. */
function visaArrivalDate(travelDetails: unknown): string | null {
  if (!travelDetails || typeof travelDetails !== "object") return null;
  const value = (travelDetails as Record<string, unknown>).arrivalDate;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type MyBookingsResult = {
  bookings: UnifiedBooking[];
  orderMeta: Map<string, { orderNumber: string | null; total: number; currency: string }>;
};

/**
 * Every booking belonging to the signed-in customer across all five verticals,
 * normalised into one shape and annotated with the order it was bought under.
 *
 * The five vertical queries plus the order lookup run concurrently — they are
 * independent, and serialising them would make this page six round trips deep.
 */
export async function getMyBookings(): Promise<MyBookingsResult> {
  const profile = await requireUser();
  const supabase = await createClient();
  const orFilter = `customer_id.eq.${profile.id},booked_by.eq.${profile.id}`;

  const [hotelRes, flightRes, visaRes, umrahRes, umrahDraftRes, hallRes, orderItemsRes] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select("id, check_in, check_out, status, total_price, currency, created_at, hotels(name)")
      .or(orFilter),
    supabase
      .from("flight_bookings")
      .select(
        "id, origin_iata, destination_iata, depart_at, status, total_price, currency, created_at"
      )
      .or(orFilter),
    supabase
      .from("visa_applications")
      .select("id, status, price, currency, created_at, travel_details, visa_types(name)")
      .or(`applicant_profile_id.eq.${profile.id},submitted_by.eq.${profile.id}`),
    supabase
      .from("umrah_bookings")
      .select(
        "id, status, total_price, currency, created_at, num_pilgrims, booking_kind, umrah_packages(name), umrah_package_departures(departure_date, return_date), umrah_custom_requests(reference, departure_date)"
      )
      .or(orFilter),
    // A private-Umrah draft has no umrah_bookings row at all — that's only
    // created on final submit (see submitUmrahCustomRequest) — so without
    // this second query, a build abandoned mid-wizard is invisible here even
    // though it's exactly the kind of unfinished work this page exists to
    // surface. Mirrors how visa_applications above is queried with no status
    // filter, so its own drafts already flow through the same way.
    supabase
      .from("umrah_custom_requests")
      .select("id, reference, status, current_step, num_pilgrims, departure_date, subtotal, currency, created_at")
      .eq("status", "draft")
      .or(orFilter),
    supabase
      .from("hall_bookings")
      .select(
        "id, event_type, start_date, end_date, status, price, currency, created_at, event_venues(name)"
      )
      .or(orFilter),
    supabase
      .from("order_items")
      .select(
        "order_id, hotel_booking_id, flight_booking_id, visa_application_id, umrah_booking_id, hall_booking_id, orders!inner(order_number, status, total, currency, customer_id, booked_by)"
      )
      .or(orFilter, { referencedTable: "orders" }),
  ]);

  const orderByBooking = new Map<string, { orderId: string; status: string }>();
  const orderMeta = new Map<string, { orderNumber: string | null; total: number; currency: string }>();

  for (const item of orderItemsRes.data ?? []) {
    // The !inner join with an .or() filter can still surface agency-visible
    // rows; this narrows to orders the customer personally owns, matching what
    // the rest of the account section shows.
    if (item.orders.customer_id !== profile.id && item.orders.booked_by !== profile.id) continue;

    orderMeta.set(item.order_id, {
      orderNumber: item.orders.order_number,
      total: item.orders.total,
      currency: item.orders.currency,
    });

    for (const [type, fk] of Object.entries(ORDER_ITEM_FK)) {
      const bookingId = (item as unknown as Record<string, string | null>)[fk];
      if (!bookingId) continue;
      orderByBooking.set(`${type}-${bookingId}`, {
        orderId: item.order_id,
        status: item.orders.status,
      });
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
    // Both Umrah flows land in umrah_bookings. A group booking names its
    // package and travels on a scheduled departure; a private one names its
    // request reference and travels on the customer's own date.
    ...(umrahRes.data ?? []).map((u) => ({
      id: u.id,
      type: "umrah" as const,
      title:
        u.booking_kind === "private"
          ? "Private Umrah"
          : (u.umrah_packages?.name ?? "Umrah booking"),
      subtitle:
        u.booking_kind === "private" && u.umrah_custom_requests
          ? `${u.umrah_custom_requests.reference} · ${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`
          : `${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`,
      status: u.status,
      price: u.total_price,
      currency: u.currency,
      createdAt: u.created_at,
      travelDate:
        u.umrah_package_departures?.departure_date ??
        u.umrah_custom_requests?.departure_date ??
        null,
      ...link("umrah", u.id),
    })),
    // Drafts never had an order (that happens at submit), so `link()` is
    // skipped rather than looked up — an id from a different table would
    // never match anything in orderByBooking anyway, but this makes the
    // "no order" reason explicit instead of relying on a lookup miss.
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
      subtitle: `${h.event_type.replace(/_/g, " ")} · ${h.start_date}${
        h.end_date !== h.start_date ? ` → ${h.end_date}` : ""
      }`,
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

/** Cancel/refund/change requests raised against one order. */
export async function getBookingRequests(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Every request the signed-in customer has raised, newest first. */
export async function getMyBookingRequests() {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("booking_requests")
    .select("*, orders(order_number, status)")
    .eq("requested_by", profile.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}
