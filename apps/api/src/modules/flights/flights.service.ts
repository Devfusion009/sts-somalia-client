import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";
import { createAnonClient } from "../../infra/supabase/supabase-clients";
import { OrdersService } from "../orders/orders.service";
import type { BookFlightInput, BookFlightResult, FlightOffer, FlightSearchParams, FlightSearchResult } from "@sts/shared-types";
import { RedisService } from "../../infra/redis/redis.service";
import { resolveFlightProvider, type SupplierOffer } from "./flight-provider";

type StoredOffer = { binding?: string; offer: SupplierOffer; carriers: Record<string, string>; adults: number; search: FlightSearchParams };

/**
 * Flight search and booking through the selected supplier.
 *
 * search    -> offers are stored in flight_offers (service role) and the UI
 *              gets our row ids, so the raw provider offer never round-trips
 *              through the browser.
 * book      -> re-prices the offer with the provider, writes the booking,
 *              its passengers and the order at the verified price, and for
 *              an agency desk pays from the wallet in the same step.
 * ticketing -> FlightTicketingService books with the provider once the
 *              order is paid in full.
 */
@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    private readonly rls: RlsSupabaseService,
    private readonly admin: AdminSupabaseService,
    private readonly orders: OrdersService,
    private readonly cache: RedisService
  ) {}

  /** All airports (reference data) for origin/destination pickers. Public. */
  async getAirports() {
    return this.cache.cachedRead(
      "flights:airports",
      3600,
      async () => {
        const { data, error } = await createAnonClient()
          .from("airports")
          .select("iata_code, name, city, country_code")
          .order("city");
        if (error) throw error;
        return data ?? [];
      },
      { tags: ["airports"], cacheIf: (value) => Array.isArray(value) && value.length > 0 }
    );
  }

  async search(params: FlightSearchParams): Promise<FlightSearchResult> {
    try {
      const provider = await resolveFlightProvider();
      if (!provider) return { live: false, offers: [] };
      const { offers, carriers } = await provider.search(params);
      if (offers.length === 0) return { live: true, offers: [] };

      const rows = offers.map((offer) => {
        const view = provider.view("", offer, carriers);
        const payload: StoredOffer = { binding: provider.binding, offer, carriers, adults: params.adults, search: params };
        return {
          provider: provider.key,
          provider_offer_id: randomUUID(),
          origin_iata: params.origin,
          destination_iata: params.destination,
          depart_at: `${view.departAt.slice(0, 19)}Z`,
          arrive_at: `${view.arriveAt.slice(0, 19)}Z`,
          cabin_class: params.cabinClass,
          flight_number: view.flightNumbers[0] ?? null,
          price: view.totalAmount,
          currency: view.currency,
          raw_payload: payload,
          expires_at: provider.expiresAt(offer),
        };
      });
      const { data, error } = await this.admin.get().from("flight_offers").insert(rows).select("id, raw_payload");
      if (error || !data) throw new Error(error?.message ?? "offers not stored");

      const result: FlightOffer[] = data.map((row) => {
        const stored = row.raw_payload as unknown as StoredOffer;
        return provider.view(row.id, stored.offer, stored.carriers);
      });
      result.sort((a, b) => a.totalAmount - b.totalAmount);
      // Expired search rows are housekeeping only; clear them opportunistically.
      void this.admin.get().from("flight_offers").delete().lt("expires_at", new Date(Date.now() - 3600_000).toISOString()).then(() => undefined);
      return { live: true, offers: result };
    } catch (error) {
      this.logger.warn(`[flights] search failed: ${error instanceof Error ? error.message : String(error)}`);
      return { live: true, offers: [], providerError: "Flight search is unavailable right now. Try again shortly." };
    }
  }

  /** One stored search offer, for the booking page. */
  async getOffer(id: string): Promise<{ offer: FlightOffer; adults: number; search: FlightSearchParams } | null> {
    const { data } = await this.admin
      .get()
      .from("flight_offers")
      .select("id, provider, raw_payload, expires_at")
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const stored = data.raw_payload as unknown as StoredOffer;
    const provider = await resolveFlightProvider(data.provider, stored.binding);
    if (!provider) return null;
    return { offer: provider.view(data.id, stored.offer, stored.carriers), adults: stored.adults, search: stored.search };
  }

  async book(userId: string, input: BookFlightInput): Promise<BookFlightResult> {
    const admin = this.admin.get();

    const { data: row } = await admin
      .from("flight_offers")
      .select("id, provider, price, currency, raw_payload, expires_at")
      .eq("id", input.offerId)
      .maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) return { error: "This fare is no longer available. Search again." };
    const stored = row.raw_payload as unknown as StoredOffer;
    let provider;
    try { provider = await resolveFlightProvider(row.provider, stored.binding); }
    catch { return { error: "The flight provider changed. Search again." }; }
    if (!provider) return { error: "Flight booking is not available right now." };
    if (input.passengers.length !== stored.adults) return { error: `Enter details for all ${stored.adults} passengers.` };

    const departDate = stored.search.departDate;
    for (const passenger of input.passengers) {
      if (passenger.passportExpiry <= (stored.search.returnDate ?? departDate)) {
        return { error: `The passport for ${passenger.firstName} ${passenger.lastName} expires before the trip ends.` };
      }
      if (passenger.dateOfBirth >= departDate) return { error: "Check each passenger's date of birth." };
      if (provider.key === "duffel") {
        const adultBirthday = `${Number(passenger.dateOfBirth.slice(0, 4)) + 18}${passenger.dateOfBirth.slice(4)}`;
        if (adultBirthday > departDate) return { error: "This fare is for adults aged 18 or over. Contact STS to book younger passengers." };
      }
    }

    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "flight");
    if (!access.ok) return { error: access.message };
    if (input.payFromWallet && !agencyId) return { error: "Only agency bookings can be paid from a wallet." };

    // The provider confirms seats and the current fare before anything is written.
    let priced: SupplierOffer;
    try {
      priced = await provider.price(stored.offer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pricing unavailable.";
      this.logger.warn(`[flights] pricing failed: ${message}`);
      return { error: "This fare is no longer available. Search again." };
    }
    const pricedView = provider.view(row.id, priced, stored.carriers);
    const fare = Math.round(pricedView.totalAmount * 100) / 100;
    const currency = pricedView.currency;
    if (currency !== row.currency) return { error: "The fare currency changed. Search again." };
    if (!(fare > 0)) return { error: "This fare is no longer available. Search again." };
    if (fare > Number(row.price) + 0.01) {
      // Keep the new fare on the offer so the page shows it and a second
      // submit books at that price.
      await admin
        .from("flight_offers")
        .update({ price: fare, raw_payload: { ...stored, offer: priced } as never })
        .eq("id", row.id);
      return { error: `The fare has changed to ${currency} ${fare.toFixed(2)}. Review the new price and book again.` };
    }

    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, {
      agencyCustomerId: input.agencyCustomerId,
      newCustomerName: input.newCustomerName,
      newCustomerPhone: input.newCustomerPhone,
    });

    // Claim this offer atomically before creating a local order. Concurrent submits
    // cannot create two payable orders from the same selection.
    const { data: claimed, error: claimError } = await admin.from("flight_offers")
      .update({ expires_at: new Date().toISOString() }).eq("id", row.id)
      .eq("expires_at", row.expires_at).gt("expires_at", new Date().toISOString()).select("id");
    if (claimError || !claimed?.length) return { error: "This offer has already been used or expired. Search again." };

    const { data: booking, error: bookingError } = await admin
      .from("flight_bookings")
      .insert({
        customer_id: userId,
        booked_by: userId,
        agency_id: agencyId,
        agency_customer_id: agencyCustomerId,
        provider: provider.key,
        trip_type: pricedView.returnLeg ? "round_trip" : "one_way",
        origin_iata: stored.search.origin,
        destination_iata: stored.search.destination,
        depart_at: `${pricedView.departAt.slice(0, 19)}Z`,
        return_at: pricedView.returnLeg ? `${pricedView.returnLeg.departAt.slice(0, 19)}Z` : null,
        cabin_class: stored.search.cabinClass,
        status: "pending",
        total_price: fare,
        currency,
        raw_payload: { offer_id: row.id, carriers: stored.carriers, passengers: input.passengers.length, provider_binding: provider.binding, offer_expires_at: provider.expiresAt(priced) },
        offer_snapshot: priced,
        priced_at: new Date().toISOString(),
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        ticketing_status: "awaiting_payment",
      })
      .select("id")
      .single();
    if (bookingError || !booking) {
      this.logger.error(`[flights] booking insert failed: ${bookingError?.message}`);
      return { error: "The booking could not be completed. Try again." };
    }

    const { error: passengerError } = await admin.from("flight_passengers").insert(
      input.passengers.map((p, index) => ({
        booking_id: booking.id,
        passenger_type: "adult" as const,
        traveler_ref: provider.travelerId(priced, index),
        full_name: `${p.firstName} ${p.lastName}`,
        first_name: p.firstName,
        last_name: p.lastName,
        gender: p.gender,
        date_of_birth: p.dateOfBirth,
        nationality: p.nationality,
        passport_number: p.passportNumber,
        passport_expiry: p.passportExpiry,
        passport_country: p.passportCountry,
      }))
    );

    let orderId: string;
    try {
      if (passengerError) throw new Error(passengerError.message);
      const order = await this.orders.createForBooking({
        customerId: userId,
        bookedBy: userId,
        agencyId,
        agencyCustomerId,
        currency,
        itemType: "flight",
        price: fare,
        flightBookingId: booking.id,
      });
      orderId = order.id;
    } catch (error) {
      this.logger.error(`[flights] order creation failed: ${error instanceof Error ? error.message : String(error)}`);
      await admin.from("flight_bookings").delete().eq("id", booking.id);
      return { error: "The booking could not be completed. Try again." };
    }

    if (!input.payFromWallet) return { error: null, orderId, paid: false };

    const { data: order } = await this.rls.get().from("orders").select("total").eq("id", orderId).single();
    const { error: walletError } = await this.rls.get().rpc("pay_order_from_agency_wallet", {
      p_order_id: orderId,
      p_amount: Number(order?.total ?? fare),
    });
    if (walletError) {
      return { error: null, orderId, paid: false, paymentError: walletErrorMessage(walletError.message) };
    }
    return { error: null, orderId, paid: true };
  }
}

function walletErrorMessage(message: string) {
  if (/insufficient|available|balance|credit/i.test(message)) return "Wallet balance is too low. Top up, then pay from the booking.";
  return "The wallet payment did not go through. Pay from the booking.";
}
