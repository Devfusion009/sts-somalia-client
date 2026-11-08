import { z } from "zod";

/**
 * Events & halls contract — everything apps/web and apps/api agree on for
 * this domain: input DTOs (what a procedure accepts), output DTOs (what it
 * returns), and the pure rules both sides must compute identically (price,
 * capacity, labels). One file per domain; index.ts re-exports it.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const venueFiltersSchema = z.object({ city: z.string().optional(), eventType: z.string().optional() });
export type VenueFilters = z.infer<typeof venueFiltersSchema>;

export const venueOccupiedRangesSchema = z.object({
  venueId: z.string().uuid(),
  from: z.string(),
  to: z.string(),
});
export type VenueOccupiedRangesInput = z.infer<typeof venueOccupiedRangesSchema>;

export const createHallBookingSchema = z.object({
  venueId: z.string().uuid(),
  eventType: z.string().min(2, "Select the type of event."),
  eventName: z.string().max(200).optional(),
  startDate: z.string().min(1, "Choose a start date."),
  endDate: z.string().min(1, "Choose an end date."),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  expectedGuests: z.coerce.number().int().min(1, "Enter the expected number of guests."),
  setupRequirements: z.string().max(2000).optional(),
  agencyCustomerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});
export type CreateHallBookingInput = z.infer<typeof createHallBookingSchema>;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  gala_dinner: "Gala Dinner",
  graduation: "Graduation",
  conference: "Conference",
  seminar: "Seminar",
  product_launch: "Product Launch",
  training: "Training",
  ngo_summit: "NGO Summit",
  eid_celebration: "Eid Celebration",
  fundraiser: "Fundraiser",
  birthday: "Birthday",
  community_event: "Community Event",
  corporate_event: "Corporate Event",
  other: "Other",
};

/** Display name for a hall_bookings.event_type / event_venues.event_types key. */
export function eventTypeLabel(key: string): string {
  return EVENT_TYPE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Most guests a venue takes — the same greatest(standing, seated) the DB capacity guard uses. */
export function venueCapacity(venue: { capacity_seated: number | null; capacity_standing: number | null }): number | null {
  const capacity = Math.max(venue.capacity_standing ?? 0, venue.capacity_seated ?? 0);
  return capacity > 0 ? capacity : null;
}

/**
 * A hall request whose price the venue still has to set: per-person and
 * price-on-request venues, and per-hour bookings sent without times. Nothing
 * on such an order may be paid until the booking is confirmed.
 */
export function hallAwaitingQuote(booking: {
  status: string;
  start_time?: string | null;
  venue: { price_unit: string; base_price: number | string } | null;
}): boolean {
  if (booking.status !== "pending" && booking.status !== "waitlisted") return false;
  const unit = booking.venue?.price_unit;
  return (
    unit === "per_person" ||
    Number(booking.venue?.base_price ?? 0) <= 0 ||
    (unit === "per_hour" && !booking.start_time)
  );
}

export const venuePriceUnitValues = ["per_event", "per_day", "per_hour", "per_person"] as const;

export type HallPriceUnit = (typeof venuePriceUnitValues)[number];

export type HallPriceInput = {
  basePrice: number;
  priceUnit: string;
  expectedGuests: number;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
};

export type HallPriceBreakdown = {
  /** Units charged for: guests, days, hours, or 1 for a flat event fee. */
  quantity: number;
  /** Singular noun for the multiplied unit — "guest", "day", "hour", or null for a flat fee. */
  unitNoun: "guest" | "day" | "hour" | null;
  unitPrice: number;
  total: number;
  /** Venue publishes no price; the events team quotes it manually. */
  onRequest: boolean;
  /** per_hour with no times entered — quantity can't be known, so total is not yet final. */
  needsTimes: boolean;
};

/** Inclusive day count: same start and end date is one day, not zero. */
function hallDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Hours between two "HH:MM" times, rounded up; an end at or before the start is treated as overnight. */
function hallHoursPerDay(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  const spanned = minutes > 0 ? minutes : minutes + 24 * 60;
  return Math.max(1, Math.ceil(spanned / 60));
}

/**
 * The one place a hall's price is calculated. Both the customer-facing
 * estimate and the row written to hall_bookings call this, so what a
 * customer is quoted and what they are charged cannot drift apart — before
 * this existed, apps/api multiplied per_person by headcount but billed
 * per_day and per_hour venues a single unit regardless of how many days or
 * hours were booked.
 */
export function computeHallPrice(input: HallPriceInput): HallPriceBreakdown {
  const unitPrice = Number(input.basePrice) || 0;
  const flat: HallPriceBreakdown = {
    quantity: 1,
    unitNoun: null,
    unitPrice,
    total: unitPrice,
    onRequest: unitPrice <= 0,
    needsTimes: false,
  };
  if (unitPrice <= 0) return flat;

  switch (input.priceUnit) {
    case "per_person": {
      const quantity = Math.max(1, Math.floor(input.expectedGuests) || 1);
      return { ...flat, quantity, unitNoun: "guest", total: unitPrice * quantity, onRequest: false };
    }
    case "per_day": {
      const quantity = hallDayCount(input.startDate, input.endDate);
      return { ...flat, quantity, unitNoun: "day", total: unitPrice * quantity, onRequest: false };
    }
    case "per_hour": {
      const hours = hallHoursPerDay(input.startTime, input.endTime);
      if (hours === null) return { ...flat, unitNoun: "hour", needsTimes: true, onRequest: false };
      const quantity = hours * hallDayCount(input.startDate, input.endDate);
      return { ...flat, quantity, unitNoun: "hour", total: unitPrice * quantity, onRequest: false };
    }
    default:
      return { ...flat, onRequest: false };
  }
}

export const venueUpsertSchema = z.object({
  name: z.string().min(2, "Enter the venue name."),
  city: z.string().min(1, "Enter the city."),
  tagline: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  capacitySeated: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  capacityStanding: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  sizeSqm: z.coerce.number().min(1).optional().or(z.literal("").transform(() => undefined)),
  eventTypes: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default("USD"),
  priceUnit: z.enum(venuePriceUnitValues),
  status: z.enum(["draft", "pending_review"]),
});
export type VenueUpsertInput = z.infer<typeof venueUpsertSchema>;

export const updateMyVenueSchema = venueUpsertSchema.extend({ venueId: z.string().uuid() });
export type UpdateMyVenueInput = z.infer<typeof updateMyVenueSchema>;

/** A venue the calling partner owns; the partner itself always comes from the session, never the input. */
export const partnerVenueRefSchema = z.object({ venueId: z.string().uuid() });
export type PartnerVenueRefInput = z.infer<typeof partnerVenueRefSchema>;

export const venueBookingStatusValues = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;
export const updateVenueBookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(venueBookingStatusValues),
});
export type UpdateVenueBookingStatusInput = z.infer<typeof updateVenueBookingStatusSchema>;

// ---------------------------------------------------------------------------
// Status rules — mirror of the database's hall_bookings_status_guard, so no
// console offers (and no service attempts) a move the database refuses.
// waitlisted is never a choice: the allocator parks and promotes requests.
// ---------------------------------------------------------------------------

export type HallBookingMove = "confirmed" | "cancelled" | "completed" | "no_show" | "refunded";

export const HALL_MOVE_LABEL: Record<HallBookingMove, string> = {
  confirmed: "Confirm",
  cancelled: "Cancel",
  completed: "Complete",
  no_show: "No-show",
  refunded: "Mark refunded",
};

export function nextHallBookingMoves(
  b: { status: string; start_date: string; end_date: string; price: number | string },
  today: string,
  isAdmin = false
): HallBookingMove[] {
  switch (b.status) {
    case "pending":
    case "waitlisted":
      return b.end_date >= today ? ["confirmed", "cancelled"] : ["cancelled"];
    case "confirmed": {
      const moves: HallBookingMove[] = [];
      if (today >= b.start_date) moves.push("completed", "no_show");
      if (today <= b.end_date) moves.push("cancelled");
      return moves;
    }
    case "cancelled":
      return isAdmin ? ["refunded"] : [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Outputs — the public shape of a venue. Procedures declare these with
// .output(), so tRPC strips any column not listed here (partner_id,
// contact_email, status, timestamps never reach a browser).
// ---------------------------------------------------------------------------

/** A jsonb list of strings: anything else in it is dropped, a non-list reads as empty. */
const jsonList = z
  .array(z.unknown())
  .catch([])
  .transform((items) => items.filter((v): v is string => typeof v === "string" && v.length > 0));

export const publicVenueSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  city: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  capacity_seated: z.coerce.number().nullable(),
  capacity_standing: z.coerce.number().nullable(),
  size_sqm: z.coerce.number().nullable(),
  base_price: z.coerce.number(),
  currency: z.string(),
  price_unit: z.string(),
  event_types: jsonList,
  amenities: jsonList,
  images: jsonList,
  is_featured: z.boolean().catch(false),
  policies: z.string().nullable(),
});
export type PublicVenue = z.infer<typeof publicVenueSchema>;

export const publicVenueDetailSchema = publicVenueSchema.extend({
  property_links: z.array(z.object({ label: z.string(), url: z.string(), sort_order: z.coerce.number() })),
  property_reviews: z.array(
    z.object({
      id: z.string(),
      author_name: z.string(),
      rating: z.coerce.number(),
      body: z.string().nullable(),
      created_at: z.string(),
    })
  ),
});
export type PublicVenueDetail = z.infer<typeof publicVenueDetailSchema>;

export const createHallBookingResultSchema = z.object({
  orderId: z.string().uuid(),
  requiresPriceConfirmation: z.boolean(),
});
export type CreateHallBookingResult = z.infer<typeof createHallBookingResultSchema>;
