/**
 * Minimal RFC4180-ish CSV serializer for admin/agent report exports — no
 * external dependency needed for the simple flat-row exports this app does.
 * Quotes any field containing a comma, quote, or newline; doubles embedded
 * quotes per the spec.
 */
export function toCsv(rows: Record<string, string | number>[], columns?: string[]): string {
  // An empty export still carries its column names.
  if (rows.length === 0) return columns ? columns.join(",") : "";

  const headers = columns ?? Object.keys(rows[0]);
  const escapeField = (value: string | number): string => {
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeField).join(","),
    ...rows.map((row) => headers.map((h) => escapeField(row[h] ?? "")).join(",")),
  ];

  return lines.join("\r\n");
}
