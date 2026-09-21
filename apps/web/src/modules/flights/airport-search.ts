import "server-only";

/**
 * Airport / city autocomplete for the flight search form. Uses the free,
 * keyless Travelpayouts places endpoint, which returns IATA codes directly
 * (the same codes Duffel searches take) — a geocoder like Photon returns
 * cities without codes, so it can't drive this picker.
 */

export type AirportPlace = { code: string; label: string; country: string };

type RawPlace = {
  type?: string;
  code?: string;
  name?: string;
  city_name?: string | null;
  country_name?: string;
};

const ENDPOINT = process.env.AIRPORT_SEARCH_URL ?? "https://autocomplete.travelpayouts.com/places2";
const LIMIT = 8;

/** Lower is better. 4 means the API matched loosely (e.g. "heath" → Perth) — dropped. */
function score(place: RawPlace, query: string): number {
  const code = (place.code ?? "").toLowerCase();
  const name = (place.name ?? "").toLowerCase();
  const city = (place.city_name ?? "").toLowerCase();
  if (code === query) return 0;
  if (name.startsWith(query) || city.startsWith(query)) return 1;
  if (name.split(/[\s-]+/).some((w) => w.startsWith(query)) || city.split(/[\s-]+/).some((w) => w.startsWith(query))) return 2;
  if (name.includes(query) || city.includes(query)) return 3;
  return 4;
}

export async function searchAirports(input: string): Promise<AirportPlace[]> {
  const term = input.trim();
  if (term.length < 2) return [];

  const params = new URLSearchParams({ term, locale: "en" });
  params.append("types[]", "city");
  params.append("types[]", "airport");

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const raw = (await res.json()) as RawPlace[];
    const query = term.toLowerCase();

    return raw
      .filter((p) => p.code && p.name)
      .map((p, index) => ({ p, s: score(p, query), index }))
      .filter((x) => x.s < 4)
      .sort((a, b) => a.s - b.s || a.index - b.index)
      .slice(0, LIMIT)
      .map(({ p }) => ({ code: p.code!, label: p.name!, country: p.country_name ?? "" }));
  } catch {
    return [];
  }
}
