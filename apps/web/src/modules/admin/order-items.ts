import { format } from "date-fns";
import type { AdminOrder, OrderIndexRow } from "./queries";

/**
 * Turns one order line into something an operator can act on: what was bought,
 * for how many people, and — the part the admin table never showed — the dates
 * the customer actually travels.
 *
 * Every item type stores its dates differently (hotel on the booking, Umrah on
 * the departure it points at, visa inside a jsonb blob), so the travel window
 * has to be dug out per type rather than read from one column.
 *
 * Kept free of `server-only` so the page can render it without a client/server
 * split, and returns plain data so the markup stays in the page.
 */

export type OrderItemSummary = {
  type: string;
  typeLabel: string;
  title: string;
  detail: string | null;
  /** ISO dates. Null when the item genuinely has no travel window yet. */
  from: string | null;
  to: string | null;
  pax: string | null;
  status: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  flight: "Flight",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Event hall",
};

/** Pulls arrival/departure out of visa_applications.travel_details without trusting its shape. */
function visaDates(travelDetails: unknown): { from: string | null; to: string | null } {
  if (!travelDetails || typeof travelDetails !== "object") return { from: null, to: null };
  const t = travelDetails as Record<string, unknown>;
  const pick = (k: string) => (typeof t[k] === "string" && t[k] ? (t[k] as string) : null);
  return { from: pick("arrivalDate"), to: pick("departureDate") };
}

export function describeOrderItem(item: AdminOrder["order_items"][number]): OrderItemSummary {
  const base = { type: item.item_type, typeLabel: TYPE_LABEL[item.item_type] ?? item.item_type };

  switch (item.item_type) {
    case "hotel": {
      const b = item.hotel_booking;
      return {
        ...base,
        title: b?.hotel?.name ?? "Hotel booking",
        detail: b?.hotel?.city ?? null,
        from: b?.check_in ?? null,
        to: b?.check_out ?? null,
        pax: b ? `${b.num_rooms} room${b.num_rooms > 1 ? "s" : ""}` : null,
        status: b?.status ?? null,
      };
    }
    case "flight": {
      const b = item.flight_booking;
      return {
        ...base,
        title: b ? `${b.origin_iata} → ${b.destination_iata}` : "Flight booking",
        detail: b?.return_at ? "Return" : "One way",
        from: b?.depart_at ?? null,
        to: b?.return_at ?? null,
        pax: null,
        status: b?.status ?? null,
      };
    }
    case "umrah": {
      const b = item.umrah_booking;
      // The dates live on the departure the booking is attached to, not on the
      // booking itself — which is why they were invisible before.
      return {
        ...base,
        title: b?.package?.name ?? "Umrah package",
        detail: b?.package?.duration_days ? `${b.package.duration_days} days` : null,
        from: b?.departure?.departure_date ?? null,
        to: b?.departure?.return_date ?? null,
        pax: b ? `${b.num_pilgrims} pilgrim${b.num_pilgrims > 1 ? "s" : ""}` : null,
        status: b?.status ?? null,
      };
    }
    case "hall": {
      const b = item.hall_booking;
      return {
        ...base,
        title: b?.venue?.name ?? "Event hall",
        detail: b?.event_type ? b.event_type.replace(/_/g, " ") : null,
        from: b?.start_date ?? null,
        to: b?.end_date ?? null,
        pax: null,
        status: b?.status ?? null,
      };
    }
    case "visa": {
      const a = item.visa_application;
      const { from, to } = visaDates(a?.travel_details);
      return {
        ...base,
        title: a?.visa_type?.name ?? "Visa application",
        detail: a?.application_ref ?? null,
        from,
        to,
        pax: null,
        status: a?.status ?? null,
      };
    }
    default:
      return { ...base, title: item.item_type, detail: null, from: null, to: null, pax: null, status: null };
  }
}

/** "31 Aug → 7 Sep 2026", or a single date, or null when there is no window. */
export function travelWindow(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  if (f && t) {
    const sameYear = f.getFullYear() === t.getFullYear();
    return `${format(f, sameYear ? "d MMM" : "d MMM yyyy")} → ${format(t, "d MMM yyyy")}`;
  }
  return format((f ?? t)!, "d MMM yyyy");
}

/** Nights/days between the two ends, for the "how long" an operator scans for. */
export function travelLength(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const nights = Math.round(
    (new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / 86_400_000
  );
  if (nights <= 0) return null;
  return `${nights} night${nights > 1 ? "s" : ""}`;
}

/** Earliest travel date across an order, for sorting and the "departs in" hint. */
export function orderTravelStart(order: AdminOrder): string | null {
  const dates = order.order_items
    .map((i) => describeOrderItem(i).from)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}

/**
 * Earliest travel date of an order from the slim index rows — the same dates
 * describeOrderItem reads (`from`), without loading the rest of each booking.
 */
export function indexTravelStart(order: OrderIndexRow): string | null {
  const dates = order.order_items
    .map((item) => {
      switch (item.item_type) {
        case "hotel":
          return item.hotel_booking?.check_in ?? null;
        case "flight":
          return item.flight_booking?.depart_at ?? null;
        case "umrah":
          return item.umrah_booking?.departure?.departure_date ?? null;
        case "hall":
          return item.hall_booking?.start_date ?? null;
        case "visa":
          return visaDates(item.visa_application?.travel_details).from;
        default:
          return null;
      }
    })
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}
