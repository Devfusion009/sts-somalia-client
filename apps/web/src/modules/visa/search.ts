import { countryFlag, countryName, countrySearchText, normalizeSearchTerm } from "@/lib/countries";

/**
 * Destination search shared by the page (which filters the results) and the
 * hero's suggestion list, so what is suggested is exactly what is then found.
 * Matches the start of any word in the country's name, code or aliases —
 * "emir" and "dhabi" find the UAE, while "u" no longer matches every country
 * that merely contains the letter.
 */
export function matchesDestination(code: string, term: string): boolean {
  const needle = normalizeSearchTerm(term);
  if (!needle) return true;
  const haystack = countrySearchText(code);
  return haystack.startsWith(needle) || haystack.includes(` ${needle}`);
}

export type DestinationOption = {
  code: string;
  name: string;
  flag: string;
  /** Lowest price across the destination's published visa types. */
  fromPrice: number;
  currency: string;
  visaCount: number;
};

/** One row per destination country that has at least one published visa type. */
export function destinationOptions(
  visas: Array<{ destination_country_code: string; price: number | string; currency: string }>
): DestinationOption[] {
  const byCode = new Map<string, DestinationOption>();
  for (const visa of visas) {
    const code = visa.destination_country_code.toUpperCase();
    const price = Number(visa.price);
    const existing = byCode.get(code);
    if (existing) {
      existing.visaCount += 1;
      if (price < existing.fromPrice) {
        existing.fromPrice = price;
        existing.currency = visa.currency;
      }
    } else {
      byCode.set(code, { code, name: countryName(code), flag: countryFlag(code), fromPrice: price, currency: visa.currency, visaCount: 1 });
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}
