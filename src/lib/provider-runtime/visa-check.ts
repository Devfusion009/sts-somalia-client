import "server-only";
import { getActiveProviderCredentials } from "./credentials";

/**
 * Zylalabs Visa Checker API — one call per nationality returns every
 * destination bucketed by visa_free_access / visa_on_arrival / eta /
 * visa_online / visa_required. We cache the whole per-nationality response
 * (it covers ~200 destinations at once) rather than calling per lookup.
 * https://www.zylalabs.com/api-marketplace/travel+&+transportation/visa+checker+api/2154
 */
const BASE_URL = "https://www.zylalabs.com/api/2154/visa+checker+api/22528/requirements+information";

export type VisaRequirementCategory = "visa_free_access" | "visa_on_arrival" | "eta" | "visa_online" | "visa_required" | "unknown";

const CATEGORY_LABEL: Record<VisaRequirementCategory, string> = {
  visa_free_access: "Visa-free",
  visa_on_arrival: "Visa on arrival",
  eta: "Electronic travel authorization (ETA)",
  visa_online: "eVisa available online",
  visa_required: "Visa required",
  unknown: "Not available",
};

type NationalityCacheEntry = { buckets: Record<VisaRequirementCategory, Set<string>>; fetchedAt: number };
const nationalityCache = new Map<string, NationalityCacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ZylalabsCountryEntry = string | { country?: string; name?: string };

function countryName(entry: ZylalabsCountryEntry): string {
  return typeof entry === "string" ? entry : (entry.country ?? entry.name ?? "");
}

async function fetchNationalityBuckets(nationality: string, apiKey: string): Promise<Record<VisaRequirementCategory, Set<string>> | null> {
  const cached = nationalityCache.get(nationality.toLowerCase());
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.buckets;

  const res = await fetch(`${BASE_URL}?nationality=${encodeURIComponent(nationality)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as {
    data_extracted?: { visa_access_by_type?: Record<string, { countries?: ZylalabsCountryEntry[] }> };
  };
  const byType = payload.data_extracted?.visa_access_by_type;
  if (!byType) return null;

  const buckets: Record<VisaRequirementCategory, Set<string>> = {
    visa_free_access: new Set(),
    visa_on_arrival: new Set(),
    eta: new Set(),
    visa_online: new Set(),
    visa_required: new Set(),
    unknown: new Set(),
  };
  for (const key of Object.keys(byType) as VisaRequirementCategory[]) {
    if (!(key in buckets)) continue;
    for (const entry of byType[key]?.countries ?? []) {
      const name = countryName(entry).toLowerCase();
      if (name) buckets[key].add(name);
    }
  }

  nationalityCache.set(nationality.toLowerCase(), { buckets, fetchedAt: Date.now() });
  return buckets;
}

export type VisaRequirementResult = { enabled: boolean; category: VisaRequirementCategory; label: string; error?: string };

export async function checkVisaRequirement(params: { nationality: string; destinationCountry: string }): Promise<VisaRequirementResult> {
  const credentials = await getActiveProviderCredentials("zylalabs_visa");
  if (!credentials?.api_key) return { enabled: false, category: "unknown", label: CATEGORY_LABEL.unknown };

  try {
    const buckets = await fetchNationalityBuckets(params.nationality, credentials.api_key);
    if (!buckets) return { enabled: true, category: "unknown", label: CATEGORY_LABEL.unknown, error: "Visa lookup failed." };

    const destination = params.destinationCountry.toLowerCase();
    const category = (Object.keys(buckets) as VisaRequirementCategory[]).find((cat) => buckets[cat].has(destination)) ?? "unknown";
    return { enabled: true, category, label: CATEGORY_LABEL[category] };
  } catch {
    return { enabled: true, category: "unknown", label: CATEGORY_LABEL.unknown, error: "The visa provider did not respond." };
  }
}

/** Lightweight real call used by the admin "Test Connection" button. */
export async function testZylalabsVisaConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}?nationality=Somalia`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (res.ok) return { ok: true, message: "Connected successfully." };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "Authentication failed — check the API key." };
    if (res.status === 429) return { ok: false, message: "Key is valid, but the request quota is exhausted." };
    return { ok: false, message: `Zylalabs returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: "Could not reach Zylalabs." };
  }
}
