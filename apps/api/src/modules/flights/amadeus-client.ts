import type { FlightOffer, FlightSearchParams } from "@sts/shared-types";
import { env } from "../../config/env";

/**
 * Amadeus flight APIs: Flight Offers Search, Flight Offers Price and Flight
 * Create Orders, with an OAuth2 client-credentials token. Plain fetch, no
 * SDK. This is the legacy REST contract, not the Enterprise SOAP API; booking is off until AMADEUS_BASE_URL, AMADEUS_CLIENT_ID and
 * AMADEUS_CLIENT_SECRET are all set.
 *
 * Offers are passed back to Amadeus exactly as received (pricing and order
 * creation require the unmodified offer object), so they are typed loosely
 * and only the fields the UI needs are mapped.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AmadeusOffer = Record<string, any>;
export type AmadeusOrder = Record<string, any>;

export class AmadeusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
  }
}

const SEARCH_TIMEOUT_MS = 25_000;
const BOOKING_TIMEOUT_MS = 60_000;

type Config = { baseUrl: string; clientId: string; clientSecret: string };

export function amadeusConfig(): Config | null {
  const e = env();
  if (!e.AMADEUS_BASE_URL || !e.AMADEUS_CLIENT_ID || !e.AMADEUS_CLIENT_SECRET) return null;
  return { baseUrl: e.AMADEUS_BASE_URL.replace(/\/$/, ""), clientId: e.AMADEUS_CLIENT_ID, clientSecret: e.AMADEUS_CLIENT_SECRET };
}

let token: { value: string; expiresAt: number; identity: string } | null = null;

async function accessToken(config: Config): Promise<string> {
  const identity = JSON.stringify(config);
  if (token && token.identity === identity && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch(`${config.baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new AmadeusError("Amadeus authentication failed.", res.status, "auth");
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { identity, value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function call(path: string, init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number }) {
  const config = amadeusConfig();
  if (!config) throw new AmadeusError("not_configured", 503, "not_configured");
  const send = async () =>
    fetch(`${config.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${await accessToken(config)}`,
        ...(init.body ? { "Content-Type": "application/vnd.amadeus+json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  let res = await send();
  if (res.status === 401) {
    token = null;
    res = await send();
  }
  const body = (await res.json().catch(() => ({}))) as { data?: any; dictionaries?: any; errors?: Array<{ code?: number; title?: string; detail?: string }> };
  if (!res.ok) {
    const first = body.errors?.[0];
    throw new AmadeusError(first?.detail || first?.title || `Amadeus request failed (${res.status}).`, res.status, first?.code != null ? String(first.code) : null);
  }
  return body;
}

const CABIN: Record<FlightSearchParams["cabinClass"], string> = {
  economy: "ECONOMY",
  premium_economy: "PREMIUM_ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
};

export async function searchOffers(params: FlightSearchParams): Promise<{ offers: AmadeusOffer[]; carriers: Record<string, string> }> {
  const originDestinations = [
    { id: "1", originLocationCode: params.origin, destinationLocationCode: params.destination, departureDateTimeRange: { date: params.departDate } },
    ...(params.returnDate
      ? [{ id: "2", originLocationCode: params.destination, destinationLocationCode: params.origin, departureDateTimeRange: { date: params.returnDate } }]
      : []),
  ];
  const body = await call("/v2/shopping/flight-offers", {
    method: "POST",
    timeoutMs: SEARCH_TIMEOUT_MS,
    body: {
      currencyCode: "USD",
      originDestinations,
      travelers: Array.from({ length: params.adults }, (_, i) => ({ id: String(i + 1), travelerType: "ADULT" })),
      sources: ["GDS"],
      searchCriteria: {
        maxFlightOffers: 40,
        flightFilters: {
          cabinRestrictions: [
            { cabin: CABIN[params.cabinClass], coverage: "MOST_SEGMENTS", originDestinationIds: originDestinations.map((o) => o.id) },
          ],
        },
      },
    },
  });
  return { offers: Array.isArray(body.data) ? body.data : [], carriers: body.dictionaries?.carriers ?? {} };
}

/** Confirms availability and the current price of one offer. */
export async function priceOffer(offer: AmadeusOffer): Promise<AmadeusOffer> {
  const body = await call("/v1/shopping/flight-offers/pricing", {
    method: "POST",
    timeoutMs: SEARCH_TIMEOUT_MS,
    body: { data: { type: "flight-offers-pricing", flightOffers: [offer] } },
  });
  const priced = body.data?.flightOffers?.[0];
  if (!priced) throw new AmadeusError("offer_expired", 409, "offer_expired");
  return priced;
}

export type AmadeusTraveler = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  passportCountry: string;
};

function splitPhone(e164: string) {
  // The full number is stored E.164; Amadeus wants the calling code apart.
  // Country codes are 1-3 digits; the common ones for STS travellers are
  // listed so the split is exact for them.
  const digits = e164.replace(/^\+/, "");
  const known = ["252", "254", "251", "253", "255", "256", "971", "966", "974", "968", "965", "973", "90", "44", "91", "1"];
  const code = known.find((c) => digits.startsWith(c)) ?? digits.slice(0, 3);
  return { countryCallingCode: code, number: digits.slice(code.length) };
}

/** Creates the flight order (PNR). Ticket numbers may come back now or later. */
export async function createOrder(input: {
  offer: AmadeusOffer;
  travelers: AmadeusTraveler[];
  contactEmail: string;
  contactPhone: string;
}): Promise<AmadeusOrder> {
  const phone = splitPhone(input.contactPhone);
  const body = await call("/v1/booking/flight-orders", {
    method: "POST",
    timeoutMs: BOOKING_TIMEOUT_MS,
    body: {
      data: {
        type: "flight-order",
        flightOffers: [input.offer],
        travelers: input.travelers.map((t) => ({
          id: t.id,
          dateOfBirth: t.dateOfBirth,
          name: { firstName: t.firstName.toUpperCase(), lastName: t.lastName.toUpperCase() },
          gender: t.gender === "male" ? "MALE" : "FEMALE",
          contact: {
            emailAddress: input.contactEmail,
            phones: [{ deviceType: "MOBILE", ...phone }],
          },
          documents: [
            {
              documentType: "PASSPORT",
              number: t.passportNumber,
              expiryDate: t.passportExpiry,
              issuanceCountry: t.passportCountry,
              nationality: t.nationality,
              holder: true,
            },
          ],
        })),
        ticketingAgreement: { option: "CONFIRM" },
      },
    },
  });
  if (!body.data?.id) throw new AmadeusError("The provider did not return an order.", 502, null);
  return body.data;
}

export async function getOrder(orderId: string): Promise<AmadeusOrder> {
  const body = await call(`/v1/booking/flight-orders/${encodeURIComponent(orderId)}`, { method: "GET", timeoutMs: SEARCH_TIMEOUT_MS });
  return body.data ?? {};
}

/** The airline booking reference (PNR) of a flight order. */
export function orderReference(order: AmadeusOrder): string | null {
  const records = Array.isArray(order.associatedRecords) ? order.associatedRecords : [];
  return records.find((r: any) => r?.reference)?.reference ?? null;
}

/** Ticket numbers issued so far. */
export function orderTickets(order: AmadeusOrder): string[] {
  const tickets = Array.isArray(order.tickets) ? order.tickets : [];
  return tickets.map((t: any) => t?.documentNumber).filter((n: unknown): n is string => typeof n === "string" && n.length > 0);
}

/** ISO 8601 duration (PT4H30M) to minutes. */
function minutes(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return null;
  const [, days, hours, mins] = match;
  return (Number(days ?? 0) * 24 + Number(hours ?? 0)) * 60 + Number(mins ?? 0);
}

function leg(itinerary: any) {
  const segments: any[] = itinerary?.segments ?? [];
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    departAt: String(first?.departure?.at ?? ""),
    arriveAt: String(last?.arrival?.at ?? ""),
    durationMinutes: minutes(itinerary?.duration),
    stops: Math.max(0, segments.length - 1),
    origin: String(first?.departure?.iataCode ?? ""),
    destination: String(last?.arrival?.iataCode ?? ""),
    flightNumbers: segments.map((s) => `${s.carrierCode} ${s.number}`),
  };
}

/** Maps an Amadeus offer to the UI's offer shape; `id` is our stored offer id. */
export function toFlightOffer(id: string, offer: AmadeusOffer, carriers: Record<string, string>): FlightOffer {
  const outbound = leg(offer.itineraries?.[0]);
  const inbound = offer.itineraries?.[1] ? leg(offer.itineraries[1]) : null;
  const firstTraveler = offer.travelerPricings?.[0];
  const fareSegment = firstTraveler?.fareDetailsBySegment?.[0];
  const carrier = offer.validatingAirlineCodes?.[0] ?? offer.itineraries?.[0]?.segments?.[0]?.carrierCode ?? "";
  const bags = fareSegment?.includedCheckedBags?.quantity;
  return {
    id,
    airline: carriers[carrier] ? titleCase(carriers[carrier]) : carrier,
    origin: outbound.origin,
    destination: outbound.destination,
    departAt: outbound.departAt,
    arriveAt: outbound.arriveAt,
    durationMinutes: outbound.durationMinutes,
    stops: outbound.stops,
    cabinClass: String(fareSegment?.cabin ?? "ECONOMY").toLowerCase(),
    totalAmount: Number(offer.price?.grandTotal ?? offer.price?.total ?? 0),
    currency: String(offer.price?.currency ?? "USD"),
    refundable: typeof offer.pricingOptions?.refundableFare === "boolean" ? offer.pricingOptions.refundableFare : null,
    refundPenalty: null,
    changeable: null,
    changePenalty: null,
    checkedBagsIncluded: typeof bags === "number" ? bags : null,
    returnLeg: inbound
      ? { departAt: inbound.departAt, arriveAt: inbound.arriveAt, durationMinutes: inbound.durationMinutes, stops: inbound.stops }
      : null,
    flightNumbers: [...outbound.flightNumbers, ...(inbound?.flightNumbers ?? [])],
  };
}

function titleCase(name: string) {
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
