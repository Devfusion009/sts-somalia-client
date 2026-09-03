/** Display helpers for agency markup rules and requests — shared by the agent Markups page and both admin agency views. */
export const VERTICAL_LABELS: Record<string, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Events & Halls",
};

export function scopeLabel(itemType: string | null): string {
  return itemType === null ? "All services (default)" : (VERTICAL_LABELS[itemType] ?? itemType);
}

export function markupLabel(markupType: string, value: number | string | null): string {
  if (value === null) return "—";
  return markupType === "percent" ? `${Number(value)}%` : `USD ${Number(value).toFixed(2)}`;
}

/** What a request would make the rule: the new value, or removal. */
export function requestedLabel(request: { action: string; markup_type: string; value: number | string | null }): string {
  return request.action === "remove" ? "Remove rule" : markupLabel(request.markup_type, request.value);
}
