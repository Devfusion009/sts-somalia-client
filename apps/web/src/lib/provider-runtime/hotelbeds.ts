import "server-only";
import { createHash } from "node:crypto";
import { getActiveProviderCredentials } from "./credentials";
import { getRedisClient } from "@/lib/redis";

/**
 * Hotelbeds Booking API — always hits the TEST/sandbox host. A freshly
 * signed-up Hotelbeds account only ever gets test credentials; production
 * access requires a separate commercial contract with HBX Group, so
 * defaulting to test is the only environment a self-serve admin can
 * actually use. Auth: SHA256(apiKey + secret + unixTimestampSeconds),
 * sent as the X-Signature header alongside the plain Api-key header —
 * https://developer.hotelbeds.com/documentation/hotels/booking-api/.
 */
const BASE_URL = "https://api.test.hotelbeds.com";
const CONTENT_BASE_URL = "https://api.test.hotelbeds.com/hotel-content-api/1.0";

// Countries relevant to STS Somalia's market — bounds the destination-code
// lookup to a fetchable set instead of syncing Hotelbeds' entire global
// destination list.
const MARKET_COUNTRY_CODES = ["SO", "AE", "SA", "KE", "ET", "TR", "EG", "QA"];

// Was an in-process Map — broke silently across serverless cold starts (a
// fresh instance = an empty cache, no error, just quietly slower and more
// Hotelbeds calls than intended) and was never shared between concurrent
// instances. Redis-backed instead: same freshness window and stale-on-
// failure fallback behavior, just actually shared and durable across
// restarts.
type DestinationCacheEntry = { destinations: Array<{ code: string; name: string }>; fetchedAt: number };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Redis key expiry is a safety net, not the freshness mechanism — that's
// CACHE_TTL_MS, checked in application code below. Deliberately much
// longer: a failed live fetch falls back to whatever's cached even past
// the 24h freshness window (destination codes barely ever change; a stale
// list beats an empty one), so the entry needs to still be here for that.
const REDIS_KEY_TTL_SECONDS = 7 * 24 * 60 * 60;

function destinationCacheKey(countryCode: string): string {
  return `hotelbeds:destinations:${countryCode}`;
}

async function readDestinationCache(countryCode: string): Promise<DestinationCacheEntry | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(destinationCacheKey(countryCode));
    return raw ? (JSON.parse(raw) as DestinationCacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeDestinationCache(countryCode: string, entry: DestinationCacheEntry): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(destinationCacheKey(countryCode), JSON.stringify(entry), "EX", REDIS_KEY_TTL_SECONDS);
  } catch {
    // Best-effort — a write failure just means the next call refetches live.
  }
}

function authHeaders(apiKey: string, secret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256").update(`${apiKey}${secret}${timestamp}`).digest("hex");
  return {
    "Api-key": apiKey,
    "X-Signature": signature,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function fetchDestinationsForCountry(
  countryCode: string,
  apiKey: string,
  secret: string
): Promise<Array<{ code: string; name: string }>> {
  const cached = await readDestinationCache(countryCode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.destinations;

  const res = await fetch(
    `${CONTENT_BASE_URL}/locations/destinations?fields=code,name&language=ENG&countryCodes=${countryCode}&from=1&to=200`,
    { headers: authHeaders(apiKey, secret), cache: "no-store" }
  );
  if (!res.ok) return cached?.destinations ?? [];

  const payload = (await res.json()) as { destinations?: Array<{ code?: string; name?: { content?: string } }> };
  const destinations = (payload.destinations ?? [])
    .filter((d) => d.code && d.name?.content)
    .map((d) => ({ code: d.code!, name: d.name!.content! }));

  await writeDestinationCache(countryCode, { destinations, fetchedAt: Date.now() });
  return destinations;
}

/** Best-effort city name -> Hotelbeds destination code, searching the market country set. */
async function resolveDestinationCode(cityQuery: string, apiKey: string, secret: string): Promise<string | null> {
  const needle = cityQuery.trim().toLowerCase();
  if (!needle) return null;

  const perCountry = await Promise.all(
    MARKET_COUNTRY_CODES.map((cc) => fetchDestinationsForCountry(cc, apiKey, secret).catch(() => []))
  );
  const match = perCountry.flat().find((d) => d.name.toLowerCase().includes(needle));
  return match?.code ?? null;
}

export type ExternalHotelOffer = {
  id: string;
  source: "hotelbeds";
  name: string;
  city: string;
  starRating: number | null;
  minPrice: number | null;
  currency: string;
};

export type ExternalHotelSearchResult = { enabled: boolean; offers: ExternalHotelOffer[]; error?: string };

type HotelbedsRoom = { rates?: Array<{ net?: string }> };
type HotelbedsHotel = {
  code?: number;
  name?: string;
  destinationName?: string;
  categoryName?: string;
  currency?: string;
  minRate?: string;
  rooms?: HotelbedsRoom[];
};

function parseStarRating(categoryName: string | undefined): number | null {
  if (!categoryName) return null;
  const match = /(\d)\s*STAR/i.exec(categoryName);
  return match ? Number(match[1]) : null;
}

export async function searchHotelbedsAvailability(params: {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}): Promise<ExternalHotelSearchResult> {
  const credentials = await getActiveProviderCredentials("hotelbeds");
  if (!credentials?.api_key || !credentials?.api_secret) return { enabled: false, offers: [] };

  try {
    const destinationCode = await resolveDestinationCode(params.city, credentials.api_key, credentials.api_secret);
    if (!destinationCode) return { enabled: true, offers: [] };

    const res = await fetch(`${BASE_URL}/hotel-api/1.0/hotels`, {
      method: "POST",
      headers: authHeaders(credentials.api_key, credentials.api_secret),
      body: JSON.stringify({
        stay: { checkIn: params.checkIn, checkOut: params.checkOut },
        occupancies: [{ rooms: 1, adults: params.adults, children: 0 }],
        destination: { code: destinationCode },
      }),
      cache: "no-store",
    });

    if (!res.ok) return { enabled: true, offers: [], error: `Hotelbeds search failed (${res.status}).` };

    const payload = (await res.json()) as { hotels?: { hotels?: HotelbedsHotel[] } };
    const offers: ExternalHotelOffer[] = (payload.hotels?.hotels ?? []).slice(0, 20).map((h) => ({
      id: `hotelbeds-${h.code}`,
      source: "hotelbeds",
      name: h.name ?? "Hotel",
      city: h.destinationName ?? params.city,
      starRating: parseStarRating(h.categoryName),
      minPrice: h.minRate ? Number(h.minRate) : null,
      currency: h.currency ?? "EUR",
    }));

    return { enabled: true, offers };
  } catch {
    return { enabled: true, offers: [], error: "The Hotelbeds provider did not respond." };
  }
}

/** Lightweight real call used by the admin "Test Connection" button. */
export async function testHotelbedsConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${CONTENT_BASE_URL}/locations/destinations?fields=code&language=ENG&countryCodes=SO&from=1&to=1`, {
      headers: authHeaders(apiKey, apiSecret),
      cache: "no-store",
    });
    if (res.ok) return { ok: true, message: "Connected successfully." };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "Authentication failed — check the API key and secret." };
    return { ok: false, message: `Hotelbeds returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: "Could not reach Hotelbeds." };
  }
}
