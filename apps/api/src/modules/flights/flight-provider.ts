import { createHash } from "node:crypto";
import type { FlightOffer, FlightSearchParams } from "@sts/shared-types";
import { createAdminClient } from "../../infra/supabase/supabase-clients";
import { decryptCredentials } from "../../infra/provider-credentials/crypto";
import { env } from "../../config/env";
import * as amadeus from "./amadeus-client";

// Supplier payloads remain server-side; each adapter owns their interpretation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupplierOffer = Record<string, any>;
export type FlightTraveler = amadeus.AmadeusTraveler;
export type SupplierOrder = { id: string; reference: string | null; tickets: string[] };
export type FlightProvider = {
  key: "amadeus" | "duffel";
  binding: string;
  search(params: FlightSearchParams): Promise<{ offers: SupplierOffer[]; carriers: Record<string, string> }>;
  price(offer: SupplierOffer): Promise<SupplierOffer>;
  view(id: string, offer: SupplierOffer, carriers: Record<string, string>): FlightOffer;
  expiresAt(offer: SupplierOffer): string;
  travelerId(offer: SupplierOffer, index: number): string;
  create(input: { offer: SupplierOffer; travelers: FlightTraveler[]; contactEmail: string; contactPhone: string; bookingId: string }): Promise<SupplierOrder>;
  get(id: string): Promise<SupplierOrder>;
};

export class FlightProviderError extends Error {
  constructor(message: string, readonly safeToRetry = false) { super(message); }
}

const binding = (key: string, secret: string) => createHash("sha256").update(`${key}:${secret}`).digest("hex");
const ttl = () => Date.now() + 30 * 60_000;

/** Existing REST deployments only. This is not an Enterprise SOAP adapter. */
function legacyAmadeus(): FlightProvider | null {
  const config = amadeus.amadeusConfig();
  if (!config) return null;
  const order = (raw: amadeus.AmadeusOrder): SupplierOrder => ({ id: String(raw.id), reference: amadeus.orderReference(raw), tickets: amadeus.orderTickets(raw) });
  return {
    key: "amadeus", binding: binding("amadeus", `${config.baseUrl}:${config.clientId}:${config.clientSecret}`),
    search: amadeus.searchOffers, price: amadeus.priceOffer, view: amadeus.toFlightOffer,
    expiresAt: () => new Date(ttl()).toISOString(),
    travelerId: (offer, index) => offer.travelerPricings?.[index]?.travelerId ?? String(index + 1),
    create: async (input) => order(await amadeus.createOrder(input)),
    get: async (id) => order(await amadeus.getOrder(id)),
  };
}

function duration(raw?: string): number | null {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(raw ?? "");
  return match ? Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : null;
}

export function duffelView(id: string, offer: SupplierOffer): FlightOffer {
  if (typeof offer.id !== "string" || !Array.isArray(offer.slices) || !offer.slices.length ||
      offer.slices.some((slice: SupplierOffer) => !Array.isArray(slice.segments) || !slice.segments.length) ||
      !Number.isFinite(Number(offer.total_amount)) || Number(offer.total_amount) <= 0 ||
      !/^[A-Z]{3}$/.test(offer.total_currency ?? "")) {
    throw new FlightProviderError("The supplier returned an incomplete fare.");
  }
  const leg = (slice: SupplierOffer) => ({
    departAt: String(slice.segments?.[0]?.departing_at ?? ""),
    arriveAt: String(slice.segments?.[slice.segments.length - 1]?.arriving_at ?? ""),
    durationMinutes: duration(slice.duration), stops: Math.max(0, (slice.segments?.length ?? 1) - 1),
  });
  const outbound = offer.slices?.[0] ?? {};
  const conditions = offer.conditions ?? {};
  const penalty = (condition: SupplierOffer | undefined) => condition?.penalty_amount != null && condition.penalty_currency
    ? { amount: Number(condition.penalty_amount), currency: String(condition.penalty_currency) } : null;
  return {
    id, airline: offer.owner?.name ?? "Airline", ...leg(outbound),
    origin: outbound.origin?.iata_code ?? "", destination: outbound.destination?.iata_code ?? "",
    cabinClass: outbound.segments?.[0]?.passengers?.[0]?.cabin_class ?? "economy",
    totalAmount: Number(offer.total_amount), currency: String(offer.total_currency),
    refundable: conditions.refund_before_departure?.allowed ?? null,
    refundPenalty: penalty(conditions.refund_before_departure),
    changeable: conditions.change_before_departure?.allowed ?? null,
    changePenalty: penalty(conditions.change_before_departure),
    checkedBagsIncluded: outbound.segments?.[0]?.passengers?.[0]?.baggages?.find((b: { type: string }) => b.type === "checked")?.quantity ?? null,
    returnLeg: offer.slices?.[1] ? leg(offer.slices[1]) : null,
    flightNumbers: (offer.slices ?? []).flatMap((slice: SupplierOffer) => (slice.segments ?? []).map((segment: SupplierOffer) => `${segment.marketing_carrier?.iata_code ?? ""} ${segment.marketing_carrier_flight_number ?? ""}`.trim())),
  };
}

export function duffelProvider(apiKey: string): FlightProvider {
  const production = env().DEPLOYMENT_ENV === "production";
  const live = apiKey.startsWith("duffel_live_");
  if (!/^duffel_(test|live)_/.test(apiKey) || production !== live) {
    throw new FlightProviderError("Duffel credentials do not match this environment.");
  }
  async function call(path: string, body?: unknown): Promise<SupplierOffer> {
    const response = await fetch(`https://api.duffel.com${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Duffel-Version": "v2", "Content-Type": "application/json", Accept: "application/json" },
      ...(body ? { body: JSON.stringify({ data: body }) } : {}), signal: AbortSignal.timeout(body && path === "/air/orders" ? 60_000 : 25_000),
    });
    // 202 and timeouts are uncertain outcomes. Never submit a second order automatically.
    if (response.status === 202) throw new FlightProviderError("Supplier confirmation pending. Check the supplier before retrying.");
    if (!response.ok) throw new FlightProviderError(`Duffel request failed (${response.status}).`, response.status === 401 || response.status === 429);
    const result = await response.json() as { data?: SupplierOffer };
    if (!result.data) throw new FlightProviderError("Duffel returned an incomplete response.");
    if (typeof result.data.live_mode === "boolean" && result.data.live_mode !== live) throw new FlightProviderError("Duffel returned a different environment.");
    return result.data;
  }
  const expiry = (offer: SupplierOffer) => {
    const expires = Date.parse(offer.expires_at ?? "");
    if (!Number.isFinite(expires)) throw new FlightProviderError("The supplier did not provide a fare expiry.");
    return new Date(Math.min(ttl(), expires)).toISOString();
  };
  const order = (raw: SupplierOffer): SupplierOrder => {
    if (!raw.id || raw.payment_status?.awaiting_payment !== false || raw.cancelled_at) throw new FlightProviderError("Supplier order requires review before confirmation.");
    return { id: raw.id, reference: raw.booking_reference ?? null, tickets: (raw.documents ?? [])
      .filter((document: SupplierOffer) => document.type === "electronic_ticket" && typeof document.unique_identifier === "string")
      .map((document: SupplierOffer) => document.unique_identifier) };
  };
  return {
    key: "duffel", binding: binding("duffel", apiKey), view: duffelView, expiresAt: expiry,
    travelerId: (offer, index) => offer.passengers?.[index]?.id,
    async search(params) {
      const data = await call("/air/offer_requests?return_offers=true", {
        cabin_class: params.cabinClass, passengers: Array.from({ length: params.adults }, () => ({ type: "adult" })),
        slices: [{ origin: params.origin, destination: params.destination, departure_date: params.departDate },
          ...(params.returnDate ? [{ origin: params.destination, destination: params.origin, departure_date: params.returnDate }] : [])],
      });
      return { offers: (data.offers ?? []).filter((offer: SupplierOffer) => Date.parse(offer.expires_at) > Date.now()), carriers: {} };
    },
    async price(offer) {
      const priced = await call(`/air/offers/${encodeURIComponent(offer.id)}?return_available_services=false`);
      if (priced.id !== offer.id || Date.parse(expiry(priced)) <= Date.now()) throw new FlightProviderError("This fare has expired.");
      return priced;
    },
    async create(input) {
      if (Date.parse(expiry(input.offer)) <= Date.now()) throw new FlightProviderError("The fare expired before supplier booking. Review the payment.");
      duffelView("", input.offer);
      const passengerIds = new Set((input.offer.passengers ?? []).map((passenger: SupplierOffer) => passenger.id));
      if (passengerIds.size !== input.travelers.length || new Set(input.travelers.map((traveler) => traveler.id)).size !== input.travelers.length ||
          input.travelers.some((traveler) => !traveler.id || !passengerIds.has(traveler.id))) {
        throw new FlightProviderError("Passenger references do not match the selected offer.");
      }
      return order(await call("/air/orders", {
        type: "instant", selected_offers: [input.offer.id], metadata: { sts_booking_id: input.bookingId },
        payments: [{ type: "balance", amount: input.offer.total_amount, currency: input.offer.total_currency }],
        passengers: input.travelers.map((traveler) => ({
          id: traveler.id, given_name: traveler.firstName, family_name: traveler.lastName,
          born_on: traveler.dateOfBirth, gender: traveler.gender === "male" ? "m" : "f",
          title: traveler.gender === "male" ? "mr" : "ms", email: input.contactEmail, phone_number: input.contactPhone,
          identity_documents: [{ type: "passport", unique_identifier: traveler.passportNumber, expires_on: traveler.passportExpiry, issuing_country_code: traveler.passportCountry }],
        })),
      }));
    },
    get: async (id) => {
      const raw = await call(`/air/orders/${encodeURIComponent(id)}`);
      if (raw.id !== id) throw new FlightProviderError("The supplier returned a different order.");
      return order(raw);
    },
  };
}

/** An explicit disabled/deleted row always wins over legacy environment credentials. */
export async function resolveFlightProvider(key?: string, expectedBinding?: string, settlement = false): Promise<FlightProvider | null> {
  const { data, error } = await createAdminClient().from("platform_api_integrations")
    .select("provider_key,is_active,credentials_encrypted").eq("category", "flights").abortSignal(AbortSignal.timeout(5000));
  if (error) throw new FlightProviderError("Flight provider configuration is unavailable.");
  const active = (data ?? []).filter((row) => row.is_active);
  if (!key && active.length > 1) throw new FlightProviderError("Select one flight provider.");
  const row = key ? data?.find((entry) => entry.provider_key === key) : active[0];
  let provider: FlightProvider | null = null;
  if (row) {
    if ((!settlement && !row.is_active) || !row.credentials_encrypted) return null;
    if (row.provider_key !== "duffel") throw new FlightProviderError("The contracted flight adapter has not been configured.");
    let credentials: Record<string, string>;
    try { credentials = decryptCredentials(row.credentials_encrypted); }
    catch { throw new FlightProviderError("Flight credentials cannot be read."); }
    provider = duffelProvider(credentials.api_key ?? "");
  } else if ((key === "amadeus" && (settlement || !data?.length)) || (!key && !data?.length)) {
    provider = legacyAmadeus();
  }
  if (provider && expectedBinding && provider.binding !== expectedBinding) throw new FlightProviderError("The supplier account changed. Review this booking before continuing.");
  return provider;
}

export async function flightProviderReadiness(providerKey: string): Promise<{ ready: boolean; message?: string }> {
  try {
    if (providerKey !== "duffel") return { ready: false, message: "The contracted flight adapter is not configured." };
    if (!await resolveFlightProvider(providerKey, undefined, true)) return { ready: false, message: "Flight credentials are unavailable on the booking API." };
    const { data, error } = await createAdminClient().rpc("flight_supplier_ready");
    if (error || !data) return { ready: false, message: "Apply the flight supplier safety migration before activation." };
    return { ready: true };
  } catch { return { ready: false, message: "The booking API cannot read these credentials in this environment." }; }
}
