import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { createAnonClient } from "../../infra/supabase/supabase-clients";
import { OrdersService } from "../orders/orders.service";
import type { FlightSearchParams, FlightOffersFilter, RequestFlightQuoteInput } from "@sts/shared-types";
import { searchLiveFlights } from "./duffel-provider";

/**
 * Direct port of apps/web's modules/flights/{queries,actions}.ts. Booking
 * creation isn't part of this module — a quote request is just a
 * flight_bookings row (provider 'quote_request', price 0); staff finalize
 * the order from the admin side, unchanged from the original.
 */
@Injectable()
export class FlightsService {
  constructor(
    private readonly rls: RlsSupabaseService,
    private readonly orders: OrdersService
  ) {}

  /**
   * All airports (reference data) for origin/destination pickers. Public —
   * uses an anon client, not this.rls, since the marketing flights page
   * doesn't require a login (matches the original's cookie-bound client,
   * which degrades to anon-only when there's no session either).
   */
  async getAirports() {
    const { data } = await createAnonClient().from("airports").select("iata_code, name, city, country_code").order("city");
    return data ?? [];
  }

  /**
   * Reads the flight_offers cache table. No live GDS/NDC provider
   * integration in this build — returns an empty array today, which is
   * expected, not a bug (unchanged from the original's own note). Public,
   * same anon-client reasoning as getAirports.
   */
  async searchFlightOffers(filters: FlightOffersFilter) {
    let query = createAnonClient()
      .from("flight_offers")
      .select("*, airlines(name, iata_code)")
      .gt("expires_at", new Date().toISOString());

    if (filters.origin) query = query.eq("origin_iata", filters.origin.toUpperCase());
    if (filters.destination) query = query.eq("destination_iata", filters.destination.toUpperCase());
    if (filters.departDate) {
      const start = new Date(`${filters.departDate}T00:00:00.000Z`).toISOString();
      const end = new Date(`${filters.departDate}T23:59:59.999Z`).toISOString();
      query = query.gte("depart_at", start).lte("depart_at", end);
    }

    const { data } = await query.order("depart_at", { ascending: true });
    return data ?? [];
  }

  async searchLive(params: FlightSearchParams) {
    return searchLiveFlights(params);
  }

  async requestQuote(userId: string, input: RequestFlightQuoteInput) {
    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "flight");
    if (!access.ok) {
      return { error: access.message };
    }

    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, {
      agencyCustomerId: input.agencyCustomerId,
      newCustomerName: input.newCustomerName,
      newCustomerPhone: input.newCustomerPhone,
    });

    const { error } = await this.rls.get().from("flight_bookings").insert({
      customer_id: userId,
      booked_by: userId,
      agency_id: agencyId,
      agency_customer_id: agencyCustomerId,
      provider: "quote_request",
      trip_type: input.tripType,
      origin_iata: input.origin,
      destination_iata: input.destination,
      depart_at: new Date(`${input.departDate}T09:00:00Z`).toISOString(),
      return_at: input.returnDate ? new Date(`${input.returnDate}T09:00:00Z`).toISOString() : null,
      cabin_class: input.cabinClass,
      status: "pending",
      total_price: 0,
      currency: "USD",
      raw_payload: {
        passengers: input.adults,
        contact_phone: input.contactPhone,
        notes: input.notes ?? null,
        requested_at: new Date().toISOString(),
      },
    });

    if (error) return { error: error.message };
    return { error: null };
  }
}
