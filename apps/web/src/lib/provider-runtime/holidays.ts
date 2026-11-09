import "server-only";
import { createHash } from "node:crypto";
import { cachedRead } from "@/lib/redis";

/**
 * Public holidays for the admin Booking Calendar — merges two free, keyless
 * sources, since neither alone covers what a Somalia-based Umrah business
 * actually needs:
 *
 *  - Nager.Date (https://date.nager.at) for CIVIL holidays. Covers 100+
 *    countries including Somalia, but only 4 fixed-date ones for SO (New
 *    Year's Day, Labour Day, Independence Day, Republic Day) — verified
 *    live. It has NO Islamic-calendar coverage at all: Saudi Arabia and UAE
 *    aren't even in its country list (confirmed: both return 204).
 *  - Aladhan (https://api.aladhan.com) for ISLAMIC holidays — Eid al-Fitr,
 *    Eid al-Adha, Mawlid, Ashura, start of Ramadan — computed from its
 *    Hijri calendar conversion endpoint, which the more relevant holidays
 *    for this business (nobody's Umrah trip cares about "Independence Day").
 *
 * Both provider-swappable via env vars, same shape as location-search.ts;
 * neither has a credential to manage, so neither lives in the paid-provider
 * Integrations system (src/lib/provider-catalog.ts) — see the "Calendar"
 * card on /admin/integrations for a plain status note instead.
 */

export type PublicHoliday = { date: string; name: string; localName: string };

const HOLIDAYS_API_URL = process.env.HOLIDAYS_API_URL ?? "https://date.nager.at/api/v3";
const HOLIDAYS_COUNTRY_CODE = process.env.HOLIDAYS_COUNTRY_CODE ?? "SO";
const ISLAMIC_HOLIDAYS_API_URL = process.env.ISLAMIC_HOLIDAYS_API_URL ?? "https://api.aladhan.com/v1";

// Both providers are free third-party APIs the calendar page waits on. A slow
// one must cost the holiday markers, not the whole page: on timeout the
// existing catch returns no holidays for that source.
const EXTERNAL_TIMEOUT_MS = 2500;
const HOLIDAY_TTL_SECONDS = 86400;
const providerKey = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 12);

type NagerHoliday = { date: string; name: string; localName: string };

async function fetchCivilHolidaysForYear(year: number): Promise<PublicHoliday[]> {
  return cachedRead(`holidays:civil:${providerKey(HOLIDAYS_API_URL)}:${HOLIDAYS_COUNTRY_CODE}:${year}`, HOLIDAY_TTL_SECONDS, async () => {
    const res = await fetch(`${HOLIDAYS_API_URL}/PublicHolidays/${year}/${HOLIDAYS_COUNTRY_CODE}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error("Holiday provider is unavailable.");
    const payload = (await res.json()) as NagerHoliday[];
    return payload.map((h) => ({ date: h.date, name: h.name, localName: h.localName }));
  }).catch(() => []);
}

// Aladhan's per-day "holidays" field is sourced from a Sufi/Naqshbandi
// observance calendar, not a curated public-holidays list — a raw month
// pull includes 30+ entries like "Urs of Shaykh Bahaʾuddin Shah Naqshband"
// alongside the handful that are actually widely recognized. Matched
// case-insensitively against a fixed allowlist so only real holidays show;
// verified against live July/Feb/May/Jun/Aug 2026 data. "Lailat-ul-Qadr" is
// deliberately excluded — traditionally observed on any of 5 candidate odd
// nights, so it'd show as 5 near-duplicate entries rather than one date.
const ISLAMIC_HOLIDAY_KEYWORDS = ["ramadan", "eid-ul-fitr", "eid-ul-adha", "arafa", "ashura", "mawlid"];

type AladhanCalendarDay = {
  hijri: { holidays: string[] };
  gregorian: { date: string }; // DD-MM-YYYY
};

function parseAladhanDate(ddmmyyyy: string): string | null {
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchIslamicHolidaysForMonth(year: number, month: number): Promise<PublicHoliday[]> {
  return cachedRead(`holidays:islamic:${providerKey(ISLAMIC_HOLIDAYS_API_URL)}:${year}:${month}`, HOLIDAY_TTL_SECONDS, async () => {
    const res = await fetch(`${ISLAMIC_HOLIDAYS_API_URL}/gToHCalendar/${month}/${year}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error("Holiday provider is unavailable.");
    const payload = (await res.json()) as { data?: AladhanCalendarDay[] };

    const out: PublicHoliday[] = [];
    for (const day of payload.data ?? []) {
      const date = parseAladhanDate(day.gregorian.date);
      if (!date) continue;
      for (const raw of day.hijri.holidays) {
        if (!ISLAMIC_HOLIDAY_KEYWORDS.some((kw) => raw.toLowerCase().includes(kw))) continue;
        // Strip decorative religious honorifics (ﷺ, ق, ر) Aladhan appends to names.
        const name = raw.replace(/[ﷺقر]/g, "").trim();
        out.push({ date, name, localName: name });
      }
    }
    return out;
  }).catch(() => []);
}

/** Every distinct (year, month) the range [from, to] (yyyy-mm-dd) touches. */
function monthsInRange(from: string, to: string): { year: number; month: number }[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/** Civil + Islamic holidays touching [from, to] (both yyyy-mm-dd), deduped and sorted. */
export async function getPublicHolidaysInRange(from: string, to: string): Promise<PublicHoliday[]> {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const years = fromYear === toYear ? [fromYear] : [fromYear, toYear];
  const months = monthsInRange(from, to);

  const [civilResults, islamicResults] = await Promise.all([
    Promise.all(years.map(fetchCivilHolidaysForYear)),
    Promise.all(months.map((m) => fetchIslamicHolidaysForMonth(m.year, m.month))),
  ]);

  const inRange = [...civilResults.flat(), ...islamicResults.flat()].filter((h) => h.date >= from && h.date <= to);

  const seen = new Set<string>();
  return inRange
    .filter((h) => {
      const key = `${h.date}|${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function holidaysCountryCode(): string {
  return HOLIDAYS_COUNTRY_CODE;
}
