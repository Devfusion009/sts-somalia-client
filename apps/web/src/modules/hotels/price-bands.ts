/**
 * Price facets for hotel search, shared by the server page (which filters and
 * counts) and the client filter sidebar (which renders the checkboxes).
 *
 * This lives in its own module on purpose. It used to be exported from
 * `hotel-filters.tsx`, which is a `"use client"` module — a Server Component
 * importing a plain value across that boundary receives a client *reference*,
 * not the array, and `PRICE_BANDS.find(...)` blew up with
 * "find is not a function" at request time. Shared data must sit in a module
 * with no `"use client"` directive so both sides get the real value.
 */
export const PRICE_BANDS = [
  { key: "0-50", label: "Under $50", min: 0, max: 50 },
  { key: "50-100", label: "$50 – $100", min: 50, max: 100 },
  { key: "100-200", label: "$100 – $200", min: 100, max: 200 },
  { key: "200+", label: "$200+", min: 200, max: Number.POSITIVE_INFINITY },
];

/** Which band a nightly price falls into, or null when price is unknown. */
export function priceBandOf(price: number | null) {
  if (price === null) return null;
  return PRICE_BANDS.find((b) => price >= b.min && price < b.max)?.key ?? null;
}
