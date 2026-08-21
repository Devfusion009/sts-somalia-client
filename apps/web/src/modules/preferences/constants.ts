/**
 * Preference vocabularies.
 *
 * These live OUTSIDE actions.ts on purpose. A `"use server"` module may only
 * export async functions — every other export crosses the RSC boundary as a
 * server-reference proxy, so a plain array read from one arrives without its
 * methods and blows up on the first `.map()`. (Same trap as
 * modules/hotels/price-bands.ts, which was split out for the identical reason.)
 *
 * No directive here, so both the Server Action and the Client Component get
 * the real arrays.
 */

export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English", native: "English" },
  { value: "so", label: "Somali", native: "Soomaali" },
  { value: "ar", label: "Arabic", native: "العربية" },
] as const;

/**
 * Currencies offered for display.
 *
 * Only those with a rate in fx_rates will actually convert; the rest fall back
 * to showing the original price. The list is intentionally short — the
 * currencies our customers price trips in.
 */
export const DISPLAY_CURRENCIES = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "AED", label: "UAE Dirham (AED)" },
  { value: "SAR", label: "Saudi Riyal (SAR)" },
  { value: "KES", label: "Kenyan Shilling (KES)" },
  { value: "ETB", label: "Ethiopian Birr (ETB)" },
  { value: "TRY", label: "Turkish Lira (TRY)" },
  { value: "EUR", label: "Euro (EUR)" },
] as const;
