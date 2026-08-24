import { z } from "zod";

/**
 * Generated Supabase schema types — canonical source of truth for both
 * apps. Regenerate with `npm run db:types` (writes here now, not
 * apps/web/src/lib/types/database.types.ts, which is a one-line re-export
 * for backward compatibility with its many existing importers). Added
 * phase 4b: bookings.service.ts's joined selects (orders!inner(...),
 * hotels(name), etc.) need real relationship typing — without it,
 * postgrest-js can't tell a to-one join from a to-many one and infers
 * every nested relation as an array, which is wrong for every join this
 * schema actually has.
 */
import type { Database } from "./database.types";
export type { Database, Json } from "./database.types";

/**
 * Phase-0 proof of the type-sharing pattern: apps/api's response shape and
 * apps/web's expectation of it come from the same schema, not two
 * hand-kept copies. Real modules migrate their existing schemas.ts Zod
 * schemas here as they move, rather than reinventing validation apps/web
 * already has.
 */
export const meResultSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
});

export type MeResult = z.infer<typeof meResultSchema>;

/**
 * Phase-1 (affiliates module) — direct ports of the Zod shapes that used
 * to live in apps/web's modules/affiliates/actions.ts and admin-actions.ts,
 * not redesigned. apps/api's affiliates router and apps/web's tRPC mutation
 * callers both validate against these same schemas.
 */
export const createAffiliateLinkSchema = z.object({
  campaignName: z.string().optional(),
  targetPath: z
    .string()
    .min(1, "Enter a destination path.")
    .refine((v) => v.startsWith("/"), "Path must start with /"),
});

export type CreateAffiliateLinkInput = z.infer<typeof createAffiliateLinkSchema>;

export const recordAffiliatePayoutSchema = z.object({
  affiliateId: z.string().uuid(),
  accountId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export type RecordAffiliatePayoutInput = z.infer<typeof recordAffiliatePayoutSchema>;

/**
 * Phase-2 (preferences + identity.updateProfile).
 *
 * SUPPORTED_LANGUAGES/DISPLAY_CURRENCIES and DEFAULT_PREFERENCES used to
 * live in apps/web (modules/preferences/constants.ts and
 * lib/notifications/preferences.ts respectively) — moved here because both
 * sides of the network boundary now need them: apps/api validates against
 * them, apps/web still renders dropdown labels from them and still needs
 * DEFAULT_PREFERENCES for lib/notifications/preferences.ts's own sender-side
 * fallback (that file re-exports these from here now instead of defining
 * them, so dispatch.ts — unmigrated until phase 3 — keeps working unchanged).
 *
 * AccountLanguage was previously `Database["public"]["Enums"]["account_language"]`
 * (generated from the Postgres enum). At the time this was written apps/api
 * had no generated database types, so this was redefined from
 * SUPPORTED_LANGUAGES instead — verified identical to the live enum
 * ("en" | "so" | "ar"). Since phase 4b, `Database` is exported from this
 * package too (see database.types.ts) and RlsSupabaseService/
 * AdminSupabaseService are properly typed with it — this redefinition now
 * just needs to keep agreeing with that enum, not stand in for it entirely.
 */
export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English", native: "English" },
  { value: "so", label: "Somali", native: "Soomaali" },
  { value: "ar", label: "Arabic", native: "العربية" },
] as const;

export type AccountLanguage = (typeof SUPPORTED_LANGUAGES)[number]["value"];

/**
 * Only those with a rate in fx_rates will actually convert; the rest fall
 * back to showing the original price. The list is intentionally short — the
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

export type PreferenceValues = {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  language: AccountLanguage;
  display_currency: string;
};

/**
 * Defaults for a customer who has never opened the preferences page. Email
 * and WhatsApp on, SMS off — matching what the platform can actually
 * deliver today (Resend and Twilio WhatsApp are wired; SMS is not).
 * Defaulting SMS on would promise a channel that silently drops every
 * message.
 */
export const DEFAULT_PREFERENCES: PreferenceValues = {
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: true,
  language: "en",
  display_currency: "USD",
};

// Cast preserves the literal union (AccountLanguage), not widened to
// [string, ...string[]] — otherwise z.enum() infers `language: string` and
// that no longer satisfies notification_preferences.language's real
// Postgres enum type now that Database is properly typed (phase 4b).
const languageValues = SUPPORTED_LANGUAGES.map((l) => l.value) as [AccountLanguage, ...AccountLanguage[]];
const currencyValues = DISPLAY_CURRENCIES.map((c) => c.value) as [string, ...string[]];

export const savePreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  language: z.enum(languageValues),
  displayCurrency: z.enum(currencyValues),
});

export type SavePreferencesInput = z.infer<typeof savePreferencesSchema>;

/**
 * Direct port of apps/web's modules/identity/actions.ts::updateProfileAction
 * validation — not redesigned.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  phone: z.string().optional(),
  countryCode: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Phase-3 (notifications module — in-app notification records, NOT the
 * lib/notifications/* outbound send infrastructure, which is a different
 * system and stays in apps/web unmigrated). Direct port of apps/web's
 * modules/notifications/broadcast-actions.ts validation.
 */
export const sendBroadcastSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  body: z.string().trim().max(2000).optional(),
  audience: z.enum(["all_agency_owners", "all_agency_members"]),
});

export type SendBroadcastInput = z.infer<typeof sendBroadcastSchema>;

/**
 * Phase-3 (orders/actions.ts only — orders/helpers.ts stays in apps/web,
 * see modules/README.md-style reasoning captured in project memory: it's
 * shared booking-creation infra called by every still-unmigrated vertical).
 */
export const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/**
 * Phase-4a — the shared booking-creation infra that blocked phase 4 from
 * starting cleanly: modules/orders/helpers.ts (createOrderForBooking and
 * friends) is called by every still-unmigrated vertical (agencies/umrah/
 * visa/flights/payments/hotels/events), so deferring it again the way
 * invoicing and orders/helpers.ts itself were deferred in phase 3 would
 * just recreate the same block at phase 5. Ported now, ahead of the
 * verticals that call it, as prerequisite infra.
 *
 * order_item_type was previously `Database["public"]["Enums"]["order_item_type"]`
 * — apps/api has no generated database types, so redefined here, verified
 * against the live enum ("hotel" | "flight" | "visa" | "umrah" | "hall",
 * database.types.ts line ~4634) at the time of this migration, not a guess.
 */
export const orderItemTypeValues = ["hotel", "flight", "visa", "umrah", "hall"] as const;
export type OrderItemType = (typeof orderItemTypeValues)[number];

/**
 * Direct port of createOrderForBooking's params — one real difference: the
 * original resolved affiliate attribution from a cookie via next/headers
 * when affiliateId wasn't passed. This process (apps/api) has no request
 * cookies to read, so affiliateId/affiliateClickId are now always resolved
 * by the frontend caller first (still via apps/web's getAffiliateAttribution(),
 * unchanged) and passed in explicitly — the backend never tries to read a
 * cookie itself.
 */
export const createOrderForBookingSchema = z.object({
  customerId: z.string().uuid(),
  bookedBy: z.string().uuid(),
  agencyId: z.string().uuid().nullable(),
  agencyCustomerId: z.string().uuid().nullable().optional(),
  affiliateId: z.string().uuid().nullable().optional(),
  affiliateClickId: z.string().nullable().optional(),
  currency: z.string().min(1),
  itemType: z.enum(orderItemTypeValues),
  price: z.number(),
  // Plain string, not .uuid(): the original TypeScript interface never
  // validated these target-booking-id fields' format at all (the DB's
  // foreign-key constraint is the real authority here) — matched exactly
  // rather than over-tightened. Confirmed by real local seed data using
  // deliberately-recognizable non-RFC4122 fixture ids (e.g.
  // "ffffffff-0000-0000-0000-0000000000f1") that a strict .uuid() rejects.
  hotelBookingId: z.string().optional(),
  flightBookingId: z.string().optional(),
  visaApplicationId: z.string().optional(),
  umrahBookingId: z.string().optional(),
  hallBookingId: z.string().optional(),
  hold: z.boolean().optional(),
});

export type CreateOrderForBookingInput = z.infer<typeof createOrderForBookingSchema>;

/**
 * Direct port of getAgencyMarkupAmount's params (apps/web's
 * modules/agencies/markup.ts — only this one function ported, not the rest
 * of the agencies module, which stays in apps/web until phase 5).
 */
export const getAgencyMarkupAmountSchema = z.object({
  agencyId: z.string().uuid(),
  itemType: z.enum(orderItemTypeValues),
  netPrice: z.number(),
});

export type GetAgencyMarkupAmountInput = z.infer<typeof getAgencyMarkupAmountSchema>;

/**
 * Adapted from resolveBookedForCustomer's original FormData signature
 * (apps/web's modules/agencies/booked-for.ts) to plain typed fields — this
 * is invoked over a JSON API now, not a raw form POST.
 */
export const resolveBookedForCustomerSchema = z.object({
  agencyId: z.string().uuid().nullable(),
  agencyCustomerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});

export type ResolveBookedForCustomerInput = z.infer<typeof resolveBookedForCustomerSchema>;

// ---------------------------------------------------------------------------
// travelers (phase 4b) — direct port of apps/web's modules/travelers/schemas.ts
// ---------------------------------------------------------------------------

/**
 * Moved here rather than left in apps/web's modules/visa/schemas.ts (visa is
 * phase 6, unmigrated): travelers/schemas.ts needs this same vocabulary — a
 * saved traveler exists to prefill a visa member row, so the two lists must
 * stay identical, not merely agree today. apps/web's visa/schemas.ts now
 * re-exports this instead of defining it, so visa's still-unmigrated code
 * needs zero changes and there's one source of truth.
 */
export const RELATIONSHIPS = [
  "self",
  "spouse",
  "son",
  "daughter",
  "father",
  "mother",
  "brother",
  "sister",
  "grandfather",
  "grandmother",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const TRAVELER_DOCUMENT_TYPES = [
  { value: "passport_bio", label: "Passport (bio page)" },
  { value: "passport_photo", label: "Passport photo page" },
  { value: "national_id", label: "National ID" },
  { value: "photo", label: "Passport-size photograph" },
  { value: "vaccination", label: "Vaccination certificate" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "employment_letter", label: "Employment letter" },
  { value: "invitation_letter", label: "Invitation letter" },
  { value: "travel_insurance", label: "Travel insurance" },
  { value: "other", label: "Other document" },
] as const;
export type TravelerDocumentType = (typeof TRAVELER_DOCUMENT_TYPES)[number]["value"];

/** Months of passport validity most destinations require beyond the date of entry. */
export const PASSPORT_VALIDITY_MONTHS = 6;

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid date.");

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const travelerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the full name exactly as printed in the passport."),
    relationship: z.enum(RELATIONSHIPS),
    dateOfBirth: optionalDate,
    gender: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || v === "male" || v === "female", "Select a gender."),
    nationality: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toUpperCase() : null))
      .refine((v) => v === null || v.length === 2, "Select a nationality."),
    passportNumber: optionalText,
    passportIssueDate: optionalDate,
    passportExpiry: optionalDate,
    notes: optionalText,
  })
  .refine(
    (v) =>
      !v.passportIssueDate ||
      !v.passportExpiry ||
      new Date(v.passportIssueDate) < new Date(v.passportExpiry),
    { message: "The passport issue date must be before its expiry date.", path: ["passportIssueDate"] }
  )
  .refine((v) => !v.dateOfBirth || new Date(v.dateOfBirth) <= new Date(), {
    message: "The date of birth cannot be in the future.",
    path: ["dateOfBirth"],
  });

export type TravelerInput = z.infer<typeof travelerSchema>;

/** Direct port of travelers/actions.ts::saveTravelerAction's own extra field. */
export const saveTravelerSchema = travelerSchema.and(z.object({ travelerId: z.string().uuid().optional() }));
export type SaveTravelerInput = z.infer<typeof saveTravelerSchema>;

export const deleteTravelerSchema = z.object({ travelerId: z.string().uuid() });
export type DeleteTravelerInput = z.infer<typeof deleteTravelerSchema>;

export const deleteVaultDocumentSchema = z.object({ documentId: z.string().uuid() });
export type DeleteVaultDocumentInput = z.infer<typeof deleteVaultDocumentSchema>;

/**
 * Explicit row types for travelers.service.ts's query methods — direct
 * port of apps/web's modules/travelers/queries.ts. Needed (not just
 * stylistic) since these back tRPC procedures: without an explicit
 * annotation, TS structurally infers the return type from Supabase's
 * generated join type, which is expensive enough across the whole
 * AppRouter to trip "Type instantiation is excessively deep" (TS2589) at
 * apps/web call sites — same reasoning as bookings' MyBookingsResult.
 */
export type TravelerProfile = Database["public"]["Tables"]["traveler_profiles"]["Row"];
export type TravelerDocument = Database["public"]["Tables"]["traveler_documents"]["Row"];
export type VaultDocument = TravelerDocument & {
  traveler: { id: string; full_name: string; is_self: boolean } | null;
};

export type PassportStatus =
  | { level: "none" }
  | { level: "expired"; daysRemaining: number; expiry: string }
  | { level: "expiring"; daysRemaining: number; monthsRemaining: number; expiry: string }
  | { level: "valid"; daysRemaining: number; expiry: string };

/**
 * Classifies a passport expiry date for the warning UI. Pure function, no
 * I/O — direct port, unchanged logic.
 */
export function passportStatus(expiry: string | null | undefined): PassportStatus {
  if (!expiry) return { level: "none" };

  const expiryMs = Date.parse(`${expiry.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiryMs)) return { level: "none" };

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.round((expiryMs - todayMs) / 86_400_000);

  if (daysRemaining < 0) return { level: "expired", daysRemaining, expiry };

  const threshold = new Date(expiryMs);
  threshold.setUTCMonth(threshold.getUTCMonth() - PASSPORT_VALIDITY_MONTHS);

  if (todayMs >= threshold.getTime()) {
    return {
      level: "expiring",
      daysRemaining,
      monthsRemaining: Math.floor(daysRemaining / 30),
      expiry,
    };
  }

  return { level: "valid", daysRemaining, expiry };
}

// ---------------------------------------------------------------------------
// bookings (phase 4b) — direct port of apps/web's modules/bookings/{types,pipeline-status}.ts
// ---------------------------------------------------------------------------

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
  travelDate: string | null;
  orderId: string | null;
  orderStatus: string | null;
};

const DEAD_STATUSES = new Set(["cancelled", "rejected", "refunded", "failed", "no_show", "expired"]);
const FINISHED_STATUSES = new Set(["completed", "issued"]);

/** Buckets a booking for the upcoming / past / cancelled filter. Pure function, direct port. */
export function bookingTimeframe(booking: UnifiedBooking, now = new Date()): BookingTimeframe {
  if (DEAD_STATUSES.has(booking.status)) return "cancelled";
  if (FINISHED_STATUSES.has(booking.status)) return "past";

  if (!booking.travelDate) return "upcoming";

  const travelMs = Date.parse(booking.travelDate);
  if (Number.isNaN(travelMs)) return "upcoming";

  const travel = new Date(travelMs);
  const travelDay = Date.UTC(travel.getUTCFullYear(), travel.getUTCMonth(), travel.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return travelDay < today ? "past" : "upcoming";
}

export type Trip = {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  currency: string;
  total: number;
  createdAt: string;
  bookings: UnifiedBooking[];
  startsOn: string | null;
  timeframe: BookingTimeframe;
};

/**
 * Groups bookings into trips by their order. Pure function, adapted from
 * the original (apps/web's modules/bookings/types.ts): orderMeta is a
 * plain object here, not a Map — BookingsService.getMyBookings() returns
 * it as one since this tRPC setup has no superjson transformer (a Map
 * would serialize to `{}` over the wire, same reasoning as
 * PreferencesService.getFxRates).
 */
export function groupIntoTrips(
  bookings: UnifiedBooking[],
  orderMeta: Record<string, { orderNumber: string | null; total: number; currency: string }>
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
    const dates = items.map((b) => b.travelDate).filter((d): d is string => Boolean(d)).sort();
    const meta = orderMeta[orderId];

    return {
      orderId,
      orderNumber: meta?.orderNumber ?? null,
      orderStatus: items[0].orderStatus ?? "pending_payment",
      currency: meta?.currency ?? items[0].currency,
      total: meta?.total ?? items.reduce((sum, b) => sum + b.price, 0),
      createdAt: items.reduce((earliest, b) => (b.createdAt < earliest ? b.createdAt : earliest), items[0].createdAt),
      bookings: items,
      startsOn: dates[0] ?? null,
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

/**
 * Computed from order_status + booking_status rather than stored, so it can
 * never drift. Pure function, direct port. PIPELINE_STATUS_STYLES (Tailwind
 * classes) deliberately stays in apps/web — it's presentation, not data.
 */
export type PipelineStatus = "Pending" | "Payment Received" | "Confirmed" | "Completed" | "Cancelled";

const TERMINAL_CANCELLED = new Set(["cancelled", "refunded", "failed", "no_show"]);

export function pipelineStatus(orderStatus: string | null | undefined, bookingStatus: string): PipelineStatus {
  if (TERMINAL_CANCELLED.has(bookingStatus)) return "Cancelled";
  if (bookingStatus === "completed") return "Completed";
  if (bookingStatus === "confirmed") return "Confirmed";
  if (orderStatus === "paid" || orderStatus === "partially_paid") return "Payment Received";
  return "Pending";
}

export const openBookingRequestSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(["cancellation", "refund", "modification"]),
  reason: z
    .string()
    .trim()
    .min(10, "Tell us briefly what you need — at least a sentence helps us act on it faster.")
    .max(2000, "Please keep this under 2000 characters."),
  requestedAmount: z.number().nonnegative("Enter a valid amount.").nullable().optional(),
});
export type OpenBookingRequestInput = z.infer<typeof openBookingRequestSchema>;

export const withdrawBookingRequestSchema = z.object({
  requestId: z.string().uuid(),
  orderId: z.string().uuid(),
});
export type WithdrawBookingRequestInput = z.infer<typeof withdrawBookingRequestSchema>;

/**
 * flights — phase 4c. Direct port of modules/flights/{provider,queries,actions}.ts.
 */

export const flightSearchParamsSchema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departDate: z.string().min(1),
  returnDate: z.string().optional(),
  adults: z.number().int().min(1).max(9),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
});
export type FlightSearchParams = z.infer<typeof flightSearchParamsSchema>;

export type FarePenalty = { amount: number; currency: string } | null;

export type FlightOffer = {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number | null;
  stops: number;
  cabinClass: string;
  totalAmount: number;
  currency: string;
  refundable: boolean | null;
  refundPenalty: FarePenalty;
  changeable: boolean | null;
  changePenalty: FarePenalty;
  checkedBagsIncluded: number | null;
};

export type FlightSearchResult = {
  live: boolean;
  offers: FlightOffer[];
  providerError?: string;
};

export const flightOffersFilterSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  departDate: z.string().optional(),
});
export type FlightOffersFilter = z.infer<typeof flightOffersFilterSchema>;

export const requestFlightQuoteSchema = z
  .object({
    origin: z.string().length(3, "Select a departure airport."),
    destination: z.string().length(3, "Select a destination airport."),
    departDate: z.string().min(1, "Choose a departure date."),
    returnDate: z.string().optional(),
    tripType: z.enum(["one_way", "round_trip"]),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    adults: z.coerce.number().int().min(1, "At least one passenger.").max(9, "Maximum 9 passengers."),
    contactPhone: z.string().min(7, "Enter a contact phone number."),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => d.origin !== d.destination, {
    message: "Origin and destination must be different.",
    path: ["destination"],
  })
  .refine((d) => d.tripType !== "round_trip" || !!d.returnDate, {
    message: "Choose a return date for a round trip.",
    path: ["returnDate"],
  });
export type RequestFlightQuoteInput = z.infer<typeof requestFlightQuoteSchema>;

/**
 * events — phase 4c. Direct port of modules/events/{actions,queries,
 * venue-partner-actions,venue-partner-queries}.ts.
 */

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

export const venuePriceUnitValues = ["per_event", "per_day", "per_hour", "per_person"] as const;

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

export const venueBookingStatusValues = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;
export const updateVenueBookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(venueBookingStatusValues),
});
export type UpdateVenueBookingStatusInput = z.infer<typeof updateVenueBookingStatusSchema>;

/**
 * payments — phase 4c. Direct port of modules/payments/{registry,providers,
 * constants,actions,account-actions,account-queries,queries,saved-methods}.ts.
 * Real money-handling logic — ported behavior-preserving, not "improved".
 */

export const MIN_DEPOSIT_FRACTION = 0.5;

export const paymentMethodIdValues = [
  "card",
  "evc_plus",
  "zaad",
  "sahal",
  "edahab",
  "agency_wallet",
  "bank_transfer",
  "cash_office",
] as const;
export type PaymentMethodId = (typeof paymentMethodIdValues)[number];

export type PaymentProvider = "stripe" | "waafi" | "edahab" | "wallet" | "manual" | "test";

export type PaymentMethodDef = {
  id: PaymentMethodId;
  label: string;
  description: string;
  kind: "card" | "mobile_money" | "wallet" | "bank" | "cash";
  provider: PaymentProvider;
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

export const initiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  methodId: z.string().min(1, "Choose a payment method."),
  payerPhone: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
});
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

export const cancelPendingPaymentSchema = z.object({ paymentId: z.string().uuid() });
export const adminConfirmPaymentSchema = z.object({ paymentId: z.string().uuid() });

export const recordPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  methodLabel: z.string().min(2, 'Describe how the customer paid, e.g. "Cash — office".'),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export type InitiationResult =
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "instructions"; instructions: string; providerRef?: string }
  | { type: "success"; providerRef?: string }
  | { type: "error"; message: string };

export const savedMethodProviderValues = ["evc_plus", "zaad", "sahal", "edahab"] as const;

export const saveWalletMethodSchema = z.object({
  methodId: z.string().uuid().optional(),
  provider: z.enum(savedMethodProviderValues),
  msisdn: z
    .string()
    .trim()
    .min(7, "Enter the full wallet number.")
    .max(20, "That number is too long.")
    .regex(/^\+?[\d\s-]+$/, "Use digits only, with optional spaces or dashes."),
  label: z
    .string()
    .trim()
    .max(60, "Keep the nickname under 60 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  makeDefault: z.boolean(),
});
export type SaveWalletMethodInput = z.infer<typeof saveWalletMethodSchema>;

export const deleteWalletMethodSchema = z.object({ methodId: z.string().uuid() });
export const setDefaultWalletMethodSchema = z.object({ methodId: z.string().uuid() });

export type SavableWallet = { id: string; label: string; description: string; hint: string };

export const SAVABLE_WALLETS: SavableWallet[] = [
  { id: "evc_plus", label: "EVC Plus", description: "Hormuud mobile money", hint: "e.g. 61 1234567" },
  { id: "zaad", label: "ZAAD", description: "Telesom mobile money", hint: "e.g. 63 1234567" },
  { id: "sahal", label: "Sahal", description: "Golis mobile money", hint: "e.g. 90 1234567" },
  { id: "edahab", label: "eDahab", description: "Somtel eDahab", hint: "e.g. 65 1234567" },
];
export const WALLET_LABELS = new Map(SAVABLE_WALLETS.map((w) => [w.id, w.label]));

export function maskMsisdn(msisdn: string | null): string {
  if (!msisdn) return "—";
  const trimmed = msisdn.replace(/\s+/g, "");
  if (trimmed.length <= 3) return trimmed;
  return `${"•".repeat(Math.max(3, trimmed.length - 3))}${trimmed.slice(-3)}`;
}

/** Direct, complete port of apps/web's lib/countries.ts — pure data, one source of truth now. */
export const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AO: "Angola", AR: "Argentina",
  AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BH: "Bahrain",
  BD: "Bangladesh", BY: "Belarus", BE: "Belgium", BJ: "Benin", BT: "Bhutan",
  BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil",
  BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi", KH: "Cambodia",
  CM: "Cameroon", CA: "Canada", CV: "Cape Verde", CF: "Central African Republic",
  TD: "Chad", CL: "Chile", CN: "China", CO: "Colombia", KM: "Comoros",
  CG: "Congo", CD: "DR Congo", CR: "Costa Rica", CI: "Côte d'Ivoire", HR: "Croatia",
  CU: "Cuba", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", DJ: "Djibouti",
  DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt", SV: "El Salvador",
  GQ: "Equatorial Guinea", ER: "Eritrea", EE: "Estonia", SZ: "Eswatini",
  ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France", GA: "Gabon",
  GM: "Gambia", GE: "Georgia", DE: "Germany", GH: "Ghana", GR: "Greece",
  GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau", GY: "Guyana", HT: "Haiti",
  HN: "Honduras", HK: "Hong Kong", HU: "Hungary", IS: "Iceland", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel",
  IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan", KZ: "Kazakhstan",
  KE: "Kenya", KW: "Kuwait", KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia",
  LB: "Lebanon", LS: "Lesotho", LR: "Liberia", LY: "Libya", LT: "Lithuania",
  LU: "Luxembourg", MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives",
  ML: "Mali", MT: "Malta", MR: "Mauritania", MU: "Mauritius", MX: "Mexico",
  MD: "Moldova", MN: "Mongolia", ME: "Montenegro", MA: "Morocco", MZ: "Mozambique",
  MM: "Myanmar", NA: "Namibia", NP: "Nepal", NL: "Netherlands", NZ: "New Zealand",
  NI: "Nicaragua", NE: "Niger", NG: "Nigeria", MK: "North Macedonia", NO: "Norway",
  OM: "Oman", PK: "Pakistan", PS: "Palestine", PA: "Panama", PG: "Papua New Guinea",
  PY: "Paraguay", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia",
  SN: "Senegal", RS: "Serbia", SC: "Seychelles", SL: "Sierra Leone", SG: "Singapore",
  SK: "Slovakia", SI: "Slovenia", SO: "Somalia", ZA: "South Africa",
  KR: "South Korea", SS: "South Sudan", ES: "Spain", LK: "Sri Lanka", SD: "Sudan",
  SR: "Suriname", SE: "Sweden", CH: "Switzerland", SY: "Syria", TW: "Taiwan",
  TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste", TG: "Togo",
  TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan", UG: "Uganda", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
  ZM: "Zambia", ZW: "Zimbabwe",
};
export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}
