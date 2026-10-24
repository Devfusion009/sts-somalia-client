import { format, parseISO } from "date-fns";

/** `USD 1,234.00` — the console money format (currency code prefix, thousands, 2 decimals). */
export function money(amount: number | string | null | undefined, currency: string): string {
  const n = Number(amount ?? 0);
  return `${currency} ${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** `3 Nov – 7 Nov 2026` from two `yyyy-MM-dd` dates; the year is shown once when shared. */
export function dateSpan(from: string, to: string): string {
  const a = parseISO(from);
  const b = parseISO(to);
  return a.getFullYear() === b.getFullYear()
    ? `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}`
    : `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`;
}

/** `7 Nov 2026` from a `yyyy-MM-dd` date or an ISO timestamp. */
export function shortDate(value: string): string {
  return format(parseISO(value), "d MMM yyyy");
}
