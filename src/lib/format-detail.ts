/** camelCase (or snake_case) key -> "Title Case" label, e.g. "contactIdNumber" -> "Contact ID Number". */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> "camel Case"
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\biata\b/gi, "IATA");
}

export function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((v) => (v && typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function detailRows(details: unknown): Array<[string, string]> {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details as Record<string, unknown>)
    .filter(([key]) => key !== "_wizard_step")
    .map(([key, value]): [string, string] => [humanizeKey(key), formatDetailValue(value)]);
}
