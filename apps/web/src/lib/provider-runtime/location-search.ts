import "server-only";

/**
 * City/place autocomplete, provider-swappable via LOCATION_SEARCH_PROVIDER
 * so a future developer can change providers without touching call sites:
 *
 *   - "photon" (default): komoot's free, public, keyless Photon API over
 *     OpenStreetMap data — https://photon.komoot.io. No signup, no billing.
 *     PHOTON_API_URL can point this at a self-hosted instance later if the
 *     public one's rate limit ever becomes a problem.
 *   - "google": Google Places Autocomplete (New). Needs GOOGLE_MAPS_API_KEY
 *     and billing enabled — opt in by setting LOCATION_SEARCH_PROVIDER=google.
 */

export type LocationPrediction = { id: string; text: string };
export type LocationSearchResult = { enabled: boolean; predictions: LocationPrediction[] };

const PHOTON_API_URL = process.env.PHOTON_API_URL ?? "https://photon.komoot.io/api";

function providerName(): "photon" | "google" {
  return process.env.LOCATION_SEARCH_PROVIDER === "google" ? "google" : "photon";
}

type PhotonFeature = {
  properties?: { osm_id?: number; name?: string; city?: string; state?: string; country?: string };
};

// Mogadishu coordinates — biases Photon's ranking toward Somalia and the
// wider region without filtering results, since this platform's traveler
// base searches Somali/East-African/Gulf destinations far more than a
// generic global geocoder assumes. lang=en asks OSM for the English name
// (e.g. "Mogadishu") instead of the localized default (e.g. "Muqdisho").
const REGION_BIAS_LAT = 2.0469;
const REGION_BIAS_LON = 45.3182;

/** Lower is better; 3 means the name doesn't actually contain what was typed. */
function placeRank(name: string, term: string): number {
  const lower = name.toLowerCase();
  if (lower === term) return 0;
  if (lower.startsWith(term)) return 1;
  if (lower.includes(term)) return 2;
  return 3;
}

async function searchPhoton(query: string): Promise<LocationSearchResult> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
    lang: "en",
    lat: String(REGION_BIAS_LAT),
    lon: String(REGION_BIAS_LON),
    location_bias_scale: "1",
  });
  const url = `${PHOTON_API_URL}?${params.toString()}&layer=city&layer=locality`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { enabled: true, predictions: [] };

  const payload = (await res.json()) as { features?: PhotonFeature[] };
  const term = query.trim().toLowerCase();
  const predictions = (payload.features ?? [])
    .map((f, index) => {
      const p = f.properties;
      const name = p?.city ?? p?.name;
      if (!name) return null;
      const parts = [name, p?.state, p?.country].filter(Boolean);
      return {
        index,
        rank: placeRank(name, term),
        prediction: { id: String(p?.osm_id ?? name), text: parts.join(", ") },
      };
    })
    .filter((x): x is { index: number; rank: number; prediction: LocationPrediction } => x !== null)
    // Photon matches loosely — "Bosaso" also returns Bogajo (ES), Besano and
    // Bosaro (IT). Those out-rank nothing the traveller typed, so they go.
    .filter((x) => x.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.prediction)
    // OSM often holds several nodes for one place (Dubai the city and Dubai
    // the emirate resolve to the same line) — one row per label.
    .filter((p, i, all) => all.findIndex((o) => o.text === p.text) === i);

  return { enabled: true, predictions };
}

type GoogleSuggestion = { placePrediction?: { text?: { text?: string }; placeId?: string } };

async function searchGoogle(query: string): Promise<LocationSearchResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { enabled: false, predictions: [] };

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.placeId",
    },
    body: JSON.stringify({ input: query, includedRegionCodes: ["so", "ae", "ke", "et", "tr", "eg", "sa"] }),
    cache: "no-store",
  });
  if (!res.ok) return { enabled: true, predictions: [] };

  const payload = (await res.json()) as { suggestions?: GoogleSuggestion[] };
  const predictions = (payload.suggestions ?? [])
    .map((s) => ({ id: s.placePrediction?.placeId ?? "", text: s.placePrediction?.text?.text ?? "" }))
    .filter((p) => p.text);

  return { enabled: true, predictions };
}

export async function searchLocations(query: string): Promise<LocationSearchResult> {
  if (query.trim().length < 2) return { enabled: true, predictions: [] };

  try {
    return providerName() === "google" ? await searchGoogle(query) : await searchPhoton(query);
  } catch {
    return { enabled: true, predictions: [] };
  }
}
