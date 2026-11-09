import type { Database } from "@/lib/types/database.types";

export const BOOKING_PRODUCTS = [
  { key: "all", label: "All products" },
  { key: "flight", label: "Flights" },
  { key: "hotel", label: "Hotels" },
  { key: "visa", label: "Visas" },
  { key: "umrah", label: "Umrah" },
  { key: "hall", label: "Events & halls" },
] as const;

export const BOOKING_QUEUES = [
  { key: "all", label: "All bookings" },
  { key: "payment_due", label: "Payment due" },
  { key: "awaiting_price", label: "Awaiting price" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
] as const;

export type BookingFilters = {
  type?: Database["public"]["Enums"]["order_item_type"];
  queue?: typeof BOOKING_QUEUES[number]["key"];
  q?: string;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
};
export type BookingSearchParams = { [K in keyof BookingFilters | "page"]?: string | string[] };

function dateOnly(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function parseBookingFilters(params: BookingSearchParams): BookingFilters {
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const type = first(params.type);
  const queue = first(params.queue);
  const product = BOOKING_PRODUCTS.find((item) => item.key === type);
  let from = dateOnly(first(params.from)), to = dateOnly(first(params.to));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    type: product && product.key !== "all" ? product.key : undefined,
    queue: BOOKING_QUEUES.find((item) => item.key === queue)?.key ?? "all",
    q: first(params.q)?.trim().slice(0, 120) || undefined,
    from, to,
    sort: first(params.sort) === "oldest" ? "oldest" : "newest",
  };
}

/** Every control preserves the other filters; changing a filter resets pagination. */
export function bookingListHref(filters: BookingFilters, patch: Partial<BookingFilters> & { page?: number } = {}): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.type) params.set("type", next.type);
  if (next.queue && next.queue !== "all") params.set("queue", next.queue);
  if (next.q) params.set("q", next.q);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.sort === "oldest") params.set("sort", next.sort);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `/agent/bookings${query ? `?${query}` : ""}`;
}

export const BOOKING_STATUS_LABELS: Record<Database["public"]["Enums"]["order_status"], string> = {
  pending_payment: "Payment due", held: "On hold", partially_paid: "Partially paid",
  paid: "Paid", processing: "Processing", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded",
};
