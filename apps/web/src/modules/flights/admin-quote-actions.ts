"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToCustomer } from "@/lib/notifications/dispatch";
import { portalOrigin, rootOrigin } from "@/lib/subdomain";
import { createOrderForBooking, repriceQuotedOrder } from "@/modules/orders/helpers";
import { money } from "@/lib/money";

export type FlightQuoteState = { error?: string; ok?: string } | null;

const PATH = "/admin/flights";

const quoteSchema = z.object({
  bookingId: z.uuid(),
  price: z.coerce.number().positive("Enter a fare above 0.").max(1_000_000, "Fare is too large."),
  currency: z.enum(["USD"]).default("USD"),
  airline: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** In-app + email/WhatsApp to whoever placed the request (customer, or the agency's contact). */
async function notifyRequester(
  bookingId: string,
  orderId: string | null,
  type: "flight_quote_ready" | "flight_quote_declined" | "flight_ticketed",
  title: string,
  line: string
) {
  try {
    const admin = createAdminClient();
    const { data: booking } = await admin
      .from("flight_bookings")
      .select("customer_id, booked_by, agency_id, origin_iata, destination_iata, agency:agency_id(contact_email, contact_phone)")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const route = `${booking.origin_iata} → ${booking.destination_iata}`;
    const recipients = [...new Set([booking.customer_id, booking.booked_by].filter(Boolean))] as string[];
    await admin.from("notifications").insert(
      recipients.map((profileId) => ({
        profile_id: profileId,
        type,
        title,
        body: `${route} · ${line}`,
        data: { flight_booking_id: bookingId, order_id: orderId },
      }))
    );

    const agency = Array.isArray(booking.agency) ? booking.agency[0] : booking.agency;
    let email = agency?.contact_email ?? null;
    let phone = agency?.contact_phone ?? null;
    if (!booking.agency_id) {
      const { data: profile } = await admin.from("profiles").select("email, phone").eq("id", booking.customer_id).maybeSingle();
      email = profile?.email ?? null;
      phone = profile?.phone ?? null;
    }
    const url = orderId
      ? booking.agency_id
        ? `${portalOrigin("agent") || rootOrigin()}/agent/bookings/${orderId}`
        : `${rootOrigin()}/account/bookings/${orderId}`
      : `${rootOrigin()}/flights`;
    await dispatchToCustomer({
      profileId: booking.customer_id,
      email,
      phone,
      content: {
        en: {
          subject: `${title} — ${route}`,
          html: `<p><strong>${escapeHtml(route)}</strong></p><p>${escapeHtml(line)}</p><p><a href="${escapeHtml(url)}">Open your booking</a></p>`,
          text: `${route}: ${line}\n${url}`,
        },
      },
    });
  } catch {
    // Delivery is best-effort; the quote itself is already saved.
  }
}

async function loadRequest(bookingId: string) {
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("flight_bookings")
    .select(
      "id, status, provider, customer_id, booked_by, agency_id, agency_customer_id, currency, raw_payload, order_items(id, order:orders(id, status, agency_id))"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.provider !== "quote_request") return { supabase, booking: null, item: null, order: null };
  const item = booking.order_items?.[0] ?? null;
  const order = item ? (Array.isArray(item.order) ? item.order[0] : item.order) : null;
  return { supabase, booking, item, order: order ?? null };
}

/**
 * Prices a quote request. The first quote creates the unpaid order the
 * traveller pays from checkout; a re-quote before payment re-prices that
 * same order rather than opening a second one.
 */
export async function sendFlightQuote(_prev: FlightQuoteState, formData: FormData): Promise<FlightQuoteState> {
  const profile = await requirePlatformAdmin();
  const parsed = quoteSchema.safeParse({
    bookingId: formData.get("bookingId"),
    price: formData.get("price"),
    currency: formData.get("currency") || undefined,
    airline: formData.get("airline")?.toString() || undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { bookingId, price, currency, airline, note } = parsed.data;

  const { supabase, booking, item, order } = await loadRequest(bookingId);
  if (!booking) return { error: "Quote request not found." };
  if (booking.status !== "pending") return { error: "This request is already closed." };
  if (order && order.status !== "pending_payment") return { error: "The traveller has already paid. Issue the ticket instead." };

  const payload = (booking.raw_payload ?? {}) as Record<string, unknown>;
  const { error: updateError } = await supabase
    .from("flight_bookings")
    .update({
      total_price: price,
      currency,
      raw_payload: {
        ...payload,
        quote: { airline: airline ?? null, note: note ?? null, quoted_at: new Date().toISOString(), quoted_by: profile.id },
      },
    })
    .eq("id", bookingId);
  if (updateError) return { error: "Could not save the quote." };

  let orderId = order?.id ?? null;
  try {
    if (order && item) {
      await repriceQuotedOrder(supabase, order, item.id, "flight", price);
    } else {
      const created = await createOrderForBooking(supabase, {
        customerId: booking.customer_id,
        bookedBy: booking.booked_by,
        agencyId: booking.agency_id,
        agencyCustomerId: booking.agency_customer_id,
        currency,
        itemType: "flight",
        price,
        flightBookingId: bookingId,
      });
      orderId = created.id;
    }
  } catch {
    return { error: "Could not create the order for this quote." };
  }

  const fare = money(price, currency);
  void notifyRequester(
    bookingId,
    orderId,
    "flight_quote_ready",
    order ? "Flight quote updated" : "Flight quote ready",
    `${fare}${airline ? ` · ${airline}` : ""}. Pay from your booking to confirm the seats.`
  );
  revalidatePath(PATH);
  return { ok: order ? "Quote updated." : "Quote sent." };
}

const idSchema = z.object({ bookingId: z.uuid(), note: z.string().trim().max(500).optional() });

export async function declineFlightQuote(_prev: FlightQuoteState, formData: FormData): Promise<FlightQuoteState> {
  await requirePlatformAdmin();
  const parsed = idSchema.safeParse({ bookingId: formData.get("bookingId"), note: formData.get("note")?.toString() || undefined });
  if (!parsed.success) return { error: "Quote request not found." };

  const { supabase, booking, order } = await loadRequest(parsed.data.bookingId);
  if (!booking) return { error: "Quote request not found." };
  if (booking.status !== "pending") return { error: "This request is already closed." };
  if (order && order.status !== "pending_payment") return { error: "The traveller has already paid. Refund the order instead." };

  if (order) {
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    if (error) return { error: "Could not cancel the unpaid order." };
  }
  const { error } = await supabase.from("flight_bookings").update({ status: "cancelled" }).eq("id", booking.id);
  if (error) return { error: "Could not decline the request." };

  void notifyRequester(
    booking.id,
    order?.id ?? null,
    "flight_quote_declined",
    "Flight request declined",
    parsed.data.note ?? "We could not offer a fare for this route and date."
  );
  revalidatePath(PATH);
  return { ok: "Request declined." };
}

const ticketSchema = z.object({
  bookingId: z.uuid(),
  pnr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,8}$/, "Enter the 5–8 character booking reference (PNR)."),
});

/** After payment: record the airline booking reference and confirm the booking. */
export async function markFlightTicketed(_prev: FlightQuoteState, formData: FormData): Promise<FlightQuoteState> {
  await requirePlatformAdmin();
  const parsed = ticketSchema.safeParse({ bookingId: formData.get("bookingId"), pnr: formData.get("pnr") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, booking, order } = await loadRequest(parsed.data.bookingId);
  if (!booking) return { error: "Quote request not found." };
  if (booking.status !== "pending") return { error: "This request is already closed." };
  if (!order || !["paid", "processing", "completed"].includes(order.status)) {
    return { error: "Ticket only after the order is paid in full." };
  }

  const { error } = await supabase
    .from("flight_bookings")
    .update({ status: "confirmed", provider_booking_ref: parsed.data.pnr })
    .eq("id", booking.id);
  if (error) return { error: "Could not save the ticket." };

  void notifyRequester(booking.id, order.id, "flight_ticketed", "Flight ticketed", `Booking reference ${parsed.data.pnr}.`);
  revalidatePath(PATH);
  return { ok: "Ticket recorded." };
}
