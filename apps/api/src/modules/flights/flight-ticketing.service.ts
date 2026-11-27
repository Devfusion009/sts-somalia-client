import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { sendEmail } from "../../infra/notify/email";
import { escapeHtml, renderEmail } from "../../infra/notify/email-layout";
import { env } from "../../config/env";
import { AmadeusError } from "./amadeus-client";
import { resolveFlightProvider, FlightProviderError, type FlightTraveler, type SupplierOffer } from "./flight-provider";

type BookingRow = {
  id: string;
  provider: string;
  raw_payload: { provider_binding?: string };
  customer_id: string;
  booked_by: string;
  agency_id: string | null;
  origin_iata: string;
  destination_iata: string;
  depart_at: string;
  return_at: string | null;
  total_price: number;
  currency: string;
  offer_snapshot: SupplierOffer | null;
  contact_email: string | null;
  contact_phone: string | null;
  ticketing_attempts: number;
  provider_order_id: string | null;
  provider_booking_ref: string | null;
};

type Passenger = {
  traveler_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  passport_country: string | null;
};

/**
 * Books paid flights with the provider and records the outcome.
 *
 * Every 30 seconds:
 *  1. unpaid fares past their hold are closed (expire_flight_fares);
 *  2. paid bookings are claimed (claim_flight_ticketing) and booked: the PNR
 *     and any ticket numbers are saved and the traveller gets the booking
 *     receipt;
 *  3. booked orders still waiting for ticket numbers are re-read
 *     (claim_flight_ticket_checks); once numbers arrive the e-ticket receipt
 *     goes out.
 *
 * A provider call that may have reached the airline (timeout, 5xx) is never
 * retried automatically, so a fare is never booked twice: the booking is
 * marked failed and staff check it from Admin > Flight bookings. Only errors
 * that prove nothing was created (auth, rate limit, not configured) are
 * retried, up to three attempts.
 */
@Injectable()
export class FlightTicketingService {
  private readonly logger = new Logger(FlightTicketingService.name);
  private running = false;

  constructor(private readonly admin: AdminSupabaseService) {}

  @Interval(30_000)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { error } = await this.admin.get().rpc("expire_flight_fares");
      if (error) throw new Error("Flight fare expiry is unavailable.");
      await this.bookPaid();
      await this.checkTickets();
    } catch (error) {
      this.logger.warn(`[flights] ticketing tick failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async bookPaid() {
    const db = this.admin.get();
    const { data: rows, error } = await db.rpc("claim_flight_ticketing", { p_limit: 5 });
    if (error) throw new Error("Flight ticketing claims are unavailable.");
    for (const row of (rows ?? []) as unknown as BookingRow[]) {
      await this.bookOne(row);
    }
  }

  /** Books one claimed row. Exposed for the admin retry. */
  async bookOne(row: BookingRow): Promise<void> {
    const db = this.admin.get();
    const { data: passengers } = await db
      .from("flight_passengers")
      .select("traveler_ref, first_name, last_name, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, passport_country")
      .eq("booking_id", row.id)
      .order("traveler_ref");

    const travelers = ((passengers ?? []) as Passenger[]).map((p, index): FlightTraveler => {
      const [first, ...rest] = p.full_name.split(/\s+/);
      return {
        id: p.traveler_ref ?? String(index + 1),
        firstName: p.first_name ?? first,
        lastName: p.last_name ?? rest.join(" "),
        gender: p.gender === "female" ? "female" : "male",
        dateOfBirth: p.date_of_birth ?? "",
        nationality: p.nationality ?? "",
        passportNumber: p.passport_number ?? "",
        passportExpiry: p.passport_expiry ?? "",
        passportCountry: p.passport_country ?? p.nationality ?? "",
      };
    });

    if (!row.offer_snapshot || travelers.length === 0 || !row.contact_email || !row.contact_phone) {
      await this.fail(row, "Booking data is incomplete.");
      return;
    }

    try {
      const provider = await resolveFlightProvider(row.provider, row.raw_payload?.provider_binding, true);
      if (!provider) throw new FlightProviderError("Original supplier credentials are unavailable.");
      const order = await provider.create({ offer: row.offer_snapshot, travelers, contactEmail: row.contact_email, contactPhone: row.contact_phone, bookingId: row.id });
      const tickets = order.tickets;
      const pnr = order.reference;
      const now = new Date().toISOString();
      const { error: saveError } = await db
        .from("flight_bookings")
        .update({
          status: "confirmed",
          provider_order_id: String(order.id),
          provider_booking_ref: pnr,
          ticket_numbers: tickets,
          ticketing_status: tickets.length > 0 ? "ticketed" : "booked",
          ticketing_error: null,
          booked_at: now,
          ticketed_at: tickets.length > 0 ? now : null,
        })
        .eq("id", row.id);
      if (saveError) throw new FlightProviderError(`Supplier order ${order.id} was created but could not be saved. Reconcile before retrying.`);
      // An email failure must never requeue or invalidate a confirmed supplier order.
      await this.notifyTraveller({ ...row, provider_booking_ref: pnr }, tickets, travelers)
        .catch(() => this.logger.warn(`[flights] receipt delivery failed: ${row.id}`));
    } catch (error) {
      const retryable = (error instanceof FlightProviderError && error.safeToRetry) || error instanceof AmadeusError && (error.code === "auth" || error.code === "not_configured" || error.status === 429);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[flights] booking ${row.id} failed: ${message}`);
      if (retryable && row.ticketing_attempts < 3) {
        await db.from("flight_bookings").update({ ticketing_status: "queued", ticketing_error: message }).eq("id", row.id);
      } else {
        await this.fail(row, message);
      }
    }
  }

  private async checkTickets() {
    const db = this.admin.get();
    const { data: rows, error } = await db.rpc("claim_flight_ticket_checks", { p_limit: 10 });
    if (error) throw new Error("Flight ticket checks are unavailable.");
    for (const row of (rows ?? []) as unknown as BookingRow[]) {
      if (!row.provider_order_id) continue;
      try {
        const provider = await resolveFlightProvider(row.provider, row.raw_payload?.provider_binding, true);
        if (!provider) continue;
        const tickets = (await provider.get(row.provider_order_id)).tickets;
        if (tickets.length === 0) continue;
        const { error: saveError } = await db
          .from("flight_bookings")
          .update({ ticketing_status: "ticketed", ticket_numbers: tickets, ticketed_at: new Date().toISOString() })
          .eq("id", row.id);
        if (saveError) throw new Error("Ticket numbers could not be saved.");
        const { data: passengers } = await db.from("flight_passengers").select("full_name").eq("booking_id", row.id);
        await this.notifyTraveller(
          row,
          tickets,
          (passengers ?? []).map((p, i) => ({ id: String(i + 1), firstName: p.full_name, lastName: "" }) as FlightTraveler)
        );
      } catch (error) {
        this.logger.warn(`[flights] ticket check ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async fail(row: BookingRow, message: string) {
    const db = this.admin.get();
    await db.from("flight_bookings").update({ ticketing_status: "failed", ticketing_error: message.slice(0, 500) }).eq("id", row.id);
    const route = `${row.origin_iata} → ${row.destination_iata}`;
    const { data: admins } = await db.from("profiles").select("id").eq("is_platform_admin", true);
    await db.from("notifications").insert([
      ...(admins ?? []).map((a) => ({
        profile_id: a.id,
        type: "flight_ticketing_failed",
        title: `Flight booking failed · ${route}`,
        body: "Payment received. Check the supplier booking status before retrying.",
        data: { flight_booking_id: row.id },
      })),
      ...[...new Set([row.customer_id, row.booked_by])].map((profileId) => ({
        profile_id: profileId,
        type: "flight_booking_delayed",
        title: "Your ticket is being finalised",
        body: `${route} · Our team is completing your booking and will contact you.`,
        data: { flight_booking_id: row.id },
      })),
    ]);
  }

  private async notifyTraveller(row: BookingRow, tickets: string[], travelers: FlightTraveler[]) {
    const db = this.admin.get();
    const route = `${row.origin_iata} → ${row.destination_iata}`;
    const ticketed = tickets.length > 0;
    const { data: item } = await db.from("order_items").select("order:orders(id, order_number)").eq("flight_booking_id", row.id).maybeSingle();
    const order = (Array.isArray(item?.order) ? item?.order[0] : item?.order) as { id: string; order_number: string } | undefined;

    await db.from("notifications").insert(
      [...new Set([row.customer_id, row.booked_by])].map((profileId) => ({
        profile_id: profileId,
        type: ticketed ? "flight_ticketed" : "flight_booked",
        title: ticketed ? "E-ticket issued" : "Flight booked",
        body: `${route} · Booking reference ${row.provider_booking_ref ?? "pending"}`,
        data: { flight_booking_id: row.id, order_id: order?.id ?? null },
      }))
    );

    if (!row.contact_email) return;
    const site = (env().NEXT_PUBLIC_SITE_URL ?? "https://scoutsts.com").replace(/\/$/, "");
    const href = order ? (row.agency_id ? `${site}/agent/bookings/${order.id}` : `${site}/account/bookings/${order.id}`) : site;
    const date = (iso: string | null) =>
      iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "";
    const names = travelers.map((t) => `${t.firstName} ${t.lastName}`.trim().toUpperCase()).join(", ");
    const details = [
      { label: "Booking reference", value: row.provider_booking_ref ?? "Pending", mono: true },
      { label: "Route", value: route },
      { label: "Departure", value: date(row.depart_at) },
      ...(row.return_at ? [{ label: "Return", value: date(row.return_at) }] : []),
      { label: "Passengers", value: names },
      ...(ticketed ? [{ label: tickets.length > 1 ? "Ticket numbers" : "Ticket number", value: tickets.join(", "), mono: true }] : []),
      { label: "Amount paid", value: `${row.currency} ${Number(row.total_price).toFixed(2)}` },
      ...(order ? [{ label: "Order", value: order.order_number, mono: true }] : []),
    ];
    const heading = ticketed ? "Your e-ticket is issued" : "Your flight is booked";
    const line = ticketed
      ? "Your ticket is issued. Show your passport and this booking reference at check-in."
      : "Your seats are confirmed with the airline. Ticket numbers follow by email.";
    await sendEmail({
      to: row.contact_email,
      subject: `${ticketed ? "E-ticket" : "Booking confirmed"} · ${route} · ${row.provider_booking_ref ?? ""}`.trim(),
      html: renderEmail({
        preheader: line,
        label: ticketed ? "E-ticket receipt" : "Booking receipt",
        tone: "success",
        heading,
        paragraphs: [escapeHtml(line)],
        details,
        button: { label: "View booking", href },
        audience: row.agency_id ? "Agent Portal" : "Flights",
      }),
    });
  }
}
