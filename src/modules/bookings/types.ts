/**
 * The unified booking row shared by the list, the filters, and the trip
 * grouping. Kept free of `server-only` imports so Client Components can hold
 * these objects as props.
 */

export type BookingType = "hotel" | "flight" | "visa" | "umrah" | "hall";

export type BookingTimeframe = "upcoming" | "past" | "cancelled";

export type UnifiedBooking = {
  id: string;
  type: BookingType;
  title: string;
  subtitle: string;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  /**
   * When the customer actually travels — check-in, departure, event date.
   * Null for records with no date yet (a visa application with no itinerary
   * entered), which is why the timeframe rules below never assume one exists.
   */
  travelDate: string | null;
  orderId: string | null;
  orderStatus: string | null;
};

/**
 * Statuses that mean the booking is off — the customer is not travelling on it
 * and should not be nagged about it in "upcoming".
 *
 * `refunded` counts as cancelled rather than past: money came back, so the
 * trip didn't happen.
 */
const DEAD_STATUSES = new Set([
  "cancelled",
  "rejected",
  "refunded",
  "failed",
  "no_show",
  "expired",
]);

/** Statuses that are finished regardless of what the calendar says. */
const FINISHED_STATUSES = new Set(["completed", "issued"]);

/**
 * Buckets a booking for the upcoming / past / cancelled filter.
 *
 * Date comparison is done on the UTC calendar day so a trip departing today is
 * still "upcoming" for the whole of that day rather than flipping to "past" the
 * moment the clock passes the stored time.
 */
export function bookingTimeframe(booking: UnifiedBooking, now = new Date()): BookingTimeframe {
  if (DEAD_STATUSES.has(booking.status)) return "cancelled";
  if (FINISHED_STATUSES.has(booking.status)) return "past";

  if (!booking.travelDate) {
    // No travel date: an in-flight visa application or a request still being
    // priced. It's live work, so it belongs in upcoming.
    return "upcoming";
  }

  const travelMs = Date.parse(booking.travelDate);
  if (Number.isNaN(travelMs)) return "upcoming";

  const travel = new Date(travelMs);
  const travelDay = Date.UTC(
    travel.getUTCFullYear(),
    travel.getUTCMonth(),
    travel.getUTCDate()
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return travelDay < today ? "past" : "upcoming";
}

/** One order's worth of bookings — the "trip" in the combined itinerary view. */
export type Trip = {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  currency: string;
  total: number;
  createdAt: string;
  bookings: UnifiedBooking[];
  /** Earliest travel date across the trip's bookings, for sorting and labelling. */
  startsOn: string | null;
  timeframe: BookingTimeframe;
};

/**
 * Groups bookings into trips by their order.
 *
 * An order is the only grouping the data actually supports: it is exactly the
 * set of things bought in one checkout. Bookings with no order (a visa
 * application still in draft, say) are returned separately rather than being
 * forced into a synthetic trip.
 */
export function groupIntoTrips(
  bookings: UnifiedBooking[],
  orderMeta: Map<string, { orderNumber: string | null; total: number; currency: string }>
): { trips: Trip[]; ungrouped: UnifiedBooking[] } {
  const byOrder = new Map<string, UnifiedBooking[]>();
  const ungrouped: UnifiedBooking[] = [];

  for (const booking of bookings) {
    if (!booking.orderId) {
      ungrouped.push(booking);
      continue;
    }
    const list = byOrder.get(booking.orderId);
    if (list) list.push(booking);
    else byOrder.set(booking.orderId, [booking]);
  }

  const trips: Trip[] = [...byOrder.entries()].map(([orderId, items]) => {
    const dates = items
      .map((b) => b.travelDate)
      .filter((d): d is string => Boolean(d))
      .sort();

    const meta = orderMeta.get(orderId);

    return {
      orderId,
      orderNumber: meta?.orderNumber ?? null,
      orderStatus: items[0].orderStatus ?? "pending_payment",
      currency: meta?.currency ?? items[0].currency,
      total: meta?.total ?? items.reduce((sum, b) => sum + b.price, 0),
      createdAt: items.reduce(
        (earliest, b) => (b.createdAt < earliest ? b.createdAt : earliest),
        items[0].createdAt
      ),
      bookings: items,
      startsOn: dates[0] ?? null,
      // A trip is only "cancelled" when every leg is. One cancelled hotel
      // inside a live itinerary must not hide the flight the customer is still
      // taking.
      timeframe: items.every((b) => bookingTimeframe(b) === "cancelled")
        ? "cancelled"
        : items.some((b) => bookingTimeframe(b) === "upcoming")
          ? "upcoming"
          : "past",
    };
  });

  trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { trips, ungrouped };
}
