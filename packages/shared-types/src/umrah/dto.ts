import { z } from "zod";
import { UMRAH_FULFILLMENT_STAGES, UMRAH_STAFF_DOC_TYPES } from "./rules";

/**
 * Umrah input and output DTOs. Every procedure's input is one of these; the
 * caller's identity (customer, agent, admin) always comes from the session.
 */

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const optionalIsoDay = z.union([isoDay, z.literal("")]).optional();
const wallClock = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid time.");

/** Who an agency booking is for (agent desk); ignored for customers. */
export const bookedForSchema = z.object({
  agencyCustomerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Pilgrims
// ---------------------------------------------------------------------------

export const pilgrimDetailsSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the pilgrim's full name.").max(120),
  gender: z.enum(["male", "female"], { message: "Choose a gender." }),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  mahram_name: z.string().optional(),
  mahram_relation: z.string().optional(),
});
export type PilgrimDetails = z.infer<typeof pilgrimDetailsSchema>;

export const updatePilgrimSchema = z.object({
  pilgrimId: uuid,
  full_name: z.string().trim().min(2, "Enter the pilgrim's full name.").max(120),
  gender: z.enum(["male", "female"], { message: "Choose a gender." }),
  date_of_birth: optionalIsoDay,
  nationality: optionalText(60),
  passport_number: optionalText(20),
  passport_expiry: optionalIsoDay,
  passport_issue_country: optionalText(60),
  mahram_name: optionalText(120),
  mahram_relation: optionalText(60),
  phone: optionalText(30),
});
export type UpdatePilgrimInput = z.infer<typeof updatePilgrimSchema>;

export const documentRefSchema = z.object({ documentId: uuid });
export const bookingRefSchema = z.object({ bookingId: uuid });

// ---------------------------------------------------------------------------
// Group package booking
// ---------------------------------------------------------------------------

export const createGroupBookingSchema = bookedForSchema.extend({
  departureId: z.string().uuid("Select a departure date."),
  numPilgrims: z.number().int().min(1, "At least one pilgrim is required.").max(60),
  roomSharing: z.number().int().min(1).max(12).optional(),
  specialRequests: z.string().max(2000).optional(),
  pilgrims: z.array(pilgrimDetailsSchema),
  /** Agents may reserve without paying; ignored for customers. */
  hold: z.boolean().default(false),
});
export type CreateGroupBookingInput = z.infer<typeof createGroupBookingSchema>;

export const orderResultSchema = z.object({ orderId: z.string(), requiresApproval: z.boolean().optional() });
export type OrderResult = z.infer<typeof orderResultSchema>;

// ---------------------------------------------------------------------------
// Private trip builder
// ---------------------------------------------------------------------------

export const requestRefSchema = z.object({ requestId: uuid });

export const startTripResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resume"), requestId: z.string(), step: z.number() }),
  z.object({ kind: z.literal("created"), requestId: z.string(), step: z.literal(1) }),
  z.object({ kind: z.literal("blocked"), message: z.string() }),
]);
export type StartTripResult = z.infer<typeof startTripResultSchema>;

export const tripBasicsSchema = z.object({
  requestId: uuid,
  tier: z.enum(["basic", "standard", "premium"]),
  numPilgrims: z
    .number()
    .int()
    .min(1, "At least one traveller.")
    .max(40, "For parties over 40, contact us directly — we'll arrange a group departure."),
  departureDate: z.string().min(1, "Choose a departure date."),
  nightsMakkah: z.number().int().min(0).max(60, "Maximum 60 nights in one city."),
  nightsMadinah: z.number().int().min(0).max(60, "Maximum 60 nights in one city."),
  travellerNames: z.array(z.string()),
});
export type TripBasicsInput = z.infer<typeof tripBasicsSchema>;

export const tripServicesSchema = z.object({
  requestId: uuid,
  roomSharing: z.number().int(),
  serviceIds: z.array(z.string()),
});
export type TripServicesInput = z.infer<typeof tripServicesSchema>;

export const tripPilgrimsSchema = z.object({
  requestId: uuid,
  pilgrims: z.array(z.unknown()),
  notes: z.string().max(2000).optional(),
});
export type TripPilgrimsInput = z.infer<typeof tripPilgrimsSchema>;

export const submitTripSchema = bookedForSchema.extend({ requestId: uuid });
export type SubmitTripInput = z.infer<typeof submitTripSchema>;

// ---------------------------------------------------------------------------
// Admin — packages
// ---------------------------------------------------------------------------

export const packageRefSchema = z.object({ packageId: uuid });

const isInternationalPhone = (phone: string | undefined) => {
  const value = phone?.trim() ?? "";
  const digits = value.replace(/\D/g, "");
  return /^\+[0-9 ()-]{7,30}$/.test(value) && digits.length >= 8 && digits.length <= 15;
};

export const publicUmrahAgentContactSchema = z.object({
  name: z.string().trim().min(2, "Enter the agent's name.").max(120),
  phone: z.string().trim().refine(isInternationalPhone, "Enter an international agent number (+ and 8 to 15 digits)."),
});

export const packageUpsertSchema = z.object({
  requestFirst: z.boolean().optional(),
  formationClosesAt: z.string().datetime({offset:true}).optional(),
  paymentCutoffAt: z.string().datetime({offset:true}).optional(),
  paymentWindowHours: z.number().int().min(1).max(168).optional(),
  requestTerms: z.string().trim().min(10).max(5000).optional(),
  packageType: z.enum(["group", "private"]).optional(),
  poolVisibility: z.enum(["public", "private"]).optional(),
  organizerName: optionalText(160),
  organizerEmail: z.string().trim().email("Enter the organizer contact email.").optional(),
  id: uuid.optional(),
  name: z.string().trim().min(2, "Enter the Umrah pool name (at least 2 characters).").max(160),
  description: optionalText(4000),
  originIata: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Select the departure airport.").optional(),
  destinationIata: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Select the arrival airport.").optional(),
  durationDays: z.number().int("Enter a whole number of days.").min(2, "Duration must be at least 2 days.").max(120, "Duration cannot exceed 120 days."),
  includes: z.array(z.string()),
  basePrice: z.number().min(0, "The price can't be negative."),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Enter a 3-letter currency code."),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
  contactPersonName: optionalText(120),
  contactPersonPhone: optionalText(40),
  agentContacts: z.array(publicUmrahAgentContactSchema).max(20).optional(),
  facilities: optionalText(4000),
  accommodationDetails: optionalText(2000),
  flightDetails: optionalText(2000),
  transportDetails: optionalText(2000),
  mealsNote: optionalText(500),
  nightsMakkah: z.number().int().min(0).max(120).optional(),
  nightsMadinah: z.number().int().min(0).max(120).optional(),
  totalSeats: z.number().int("Enter a whole number of seats.").min(1, "Total seats must be at least 1.").max(10000, "Total seats cannot exceed 10,000.").optional(),
  departureDate: isoDay.optional(),
}).superRefine((value, ctx) => {
  if (value.requestFirst && (value.id || value.packageType === "private" || value.poolVisibility === "private" || !value.formationClosesAt || !value.paymentCutoffAt || !value.requestTerms || !value.paymentWindowHours || Date.parse(value.formationClosesAt) + value.paymentWindowHours * 3_600_000 > Date.parse(value.paymentCutoffAt))) {
    ctx.addIssue({code:"custom",path:["formationClosesAt"],message:"Complete public pool deadlines and terms."});
  }
  if (value.packageType === "private") return;
  if (!value.organizerName?.trim()) ctx.addIssue({ code: "custom", path: ["organizerName"], message: "Enter the organizer name." });
  if (!value.organizerEmail) ctx.addIssue({ code: "custom", path: ["organizerEmail"], message: "Enter the organizer contact email." });
  const required = { description: "package description", contactPersonName: "responsible person's name", contactPersonPhone: "contact number", facilities: "facilities", accommodationDetails: "accommodation details", flightDetails: "flight details", transportDetails: "transport details", mealsNote: "food and meal details" } as const;
  for (const key of Object.keys(required) as Array<keyof typeof required>) {
    if (!value[key]?.trim()) ctx.addIssue({ code: "custom", path: [key], message: `Enter the ${required[key]}.` });
  }
  if ((value.contactPersonName?.trim().length ?? 0) < 2) ctx.addIssue({ code: "custom", path: ["contactPersonName"], message: "Enter the responsible person's full name." });
  if (!isInternationalPhone(value.contactPersonPhone)) {
    ctx.addIssue({ code: "custom", path: ["contactPersonPhone"], message: "Enter the responsible person's international phone number (+ and 8 to 15 digits)." });
  }
  if (value.durationDays < 2 || value.durationDays > 120) ctx.addIssue({ code: "custom", path: ["durationDays"], message: "Duration must be 2 to 120 days." });
  if (value.basePrice <= 0) ctx.addIssue({ code: "custom", path: ["basePrice"], message: "Enter a price greater than zero." });
  if (!value.includes.length) ctx.addIssue({ code: "custom", path: ["includes"], message: "Select the included services." });
  const nights = (value.nightsMakkah ?? 0) + (value.nightsMadinah ?? 0);
  if ((value.nightsMakkah !== undefined || value.nightsMadinah !== undefined) && (nights < 1 || nights >= value.durationDays)) {
    ctx.addIssue({ code: "custom", path: ["nightsMakkah"], message: "Stay nights must total at least one and be fewer than the trip days." });
  }
  if (!value.id && value.totalSeats === undefined) ctx.addIssue({ code: "custom", path: ["totalSeats"], message: "Enter the total number of seats." });
  if (!value.id && !value.departureDate) ctx.addIssue({ code: "custom", path: ["departureDate"], message: "Enter the departure date." });
});
export type PackageUpsertInput = z.infer<typeof packageUpsertSchema>;

const iata = (example: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{3}$/.test(v), `Use a 3-letter airport code, e.g. ${example}.`)
    .optional();

export const packageDetailsSchema = z.object({
  packageId: uuid,
  tagline: optionalText(200),
  tier: optionalText(40),
  isFeatured: z.boolean(),
  originIata: iata("MGQ"),
  destinationIata: iata("JED"),
  originalPrice: z.number().min(0).nullable(),
  mealPlan: z.enum(["none", "breakfast", "half_board", "full_board"]),
  mealsNote: optionalText(500),
  contactPersonName: optionalText(120),
  contactPersonPhone: optionalText(40),
  contactPersonEmail: z.union([z.string().trim().email("Enter a valid contact email."), z.literal("")]).optional(),
  contactWhatsapp: optionalText(40),
  depositPercent: z.number().min(0, "Deposit must be 0 to 100%.").max(100, "Deposit must be 0 to 100%.").nullable(),
  balanceDueDays: z.number().int().min(0, "Balance due must be 0 to 180 days.").max(180, "Balance due must be 0 to 180 days."),
  fullPaymentBeforeDocuments: z.boolean(),
});
export type PackageDetailsInput = z.infer<typeof packageDetailsSchema>;

export const packageHotelSchema = z.object({
  packageId: uuid,
  hotelRowId: uuid.optional(),
  city: z.enum(["makkah", "madinah", "other"]),
  name: z.string().trim().min(2, "Enter the hotel name."),
  starRating: z.number().int().min(1).max(5).nullable(),
  distanceToHaramM: z.number().int().min(0).nullable(),
  nights: z.number().int().min(1).nullable(),
  roomType: optionalText(80),
  sortOrder: z.number().int().min(0).max(99).default(0),
});
export type PackageHotelInput = z.infer<typeof packageHotelSchema>;

export const packageChildRefSchema = z.object({ packageId: uuid, rowId: uuid });

export const itineraryDaySchema = z.object({
  packageId: uuid,
  dayId: uuid.optional(),
  dayNumber: z.number().int().min(1, "Day number starts at 1."),
  title: z.string().trim().min(2, "Give the day a title."),
  description: optionalText(2000),
});
export type ItineraryDayInput = z.infer<typeof itineraryDaySchema>;

export const packagePricingSchema = z.object({
  packageId: uuid,
  sharing: z.number().int().min(1).max(12),
  price: z.number().min(0),
});
export type PackagePricingInput = z.infer<typeof packagePricingSchema>;

export const packageAgenciesSchema = z.object({ packageId: uuid, agencyIds: z.array(uuid) });

export const imageSignSchema = z.object({
  packageId: uuid,
  name: z.string().min(1),
  type: z.enum(["image/jpeg", "image/png", "image/webp"], { message: "Only JPG, PNG, or WebP images are accepted." }),
  size: z.number().positive().max(5 * 1024 * 1024, "Images must be 5 MB or smaller."),
});
export const imagePathSchema = z.object({ packageId: uuid, path: z.string().min(1) });

// ---------------------------------------------------------------------------
// Admin — departures
// ---------------------------------------------------------------------------

export const departureUpsertSchema = z.object({
  departureId: uuid.optional(),
  packageId: uuid,
  departureDate: isoDay,
  returnDate: isoDay,
  totalSeats: z.number().int().min(1, "Total seats must be at least 1."),
  offlineSeats: z.number().int().min(0, "Offline seats cannot be negative."),
  priceOverride: z.number().min(0).nullable(),
  outboundAirline: z.string().trim().max(80).nullable(),
  outboundFlightNumber: z.string().trim().max(20).nullable(),
  outboundDepartsAt: wallClock.nullable(),
  outboundArrivesAt: wallClock.nullable(),
  returnAirline: z.string().trim().max(80).nullable(),
  returnFlightNumber: z.string().trim().max(20).nullable(),
  returnDepartsAt: wallClock.nullable(),
  returnArrivesAt: wallClock.nullable(),
  baggageNote: z.string().trim().max(200).nullable(),
  salesCloseDays: z.number().int().min(0, "Sales close must be 0 to 120 days.").max(120, "Sales close must be 0 to 120 days."),
  status: z.enum(["open", "closed"]).nullable(),
});
export type DepartureUpsertInput = z.infer<typeof departureUpsertSchema>;

export const departureRefSchema = z.object({ departureId: uuid });
export const confirmPoolSchema = departureRefSchema.extend({ departureDate: isoDay.optional() });
export const departuresOverviewSchema = z.object({ from: isoDay });

export const cancelDepartureSchema = z.object({
  departureId: uuid,
  reason: z.string().trim().min(1, "Enter a reason.").max(500),
});

const advanceStages = UMRAH_FULFILLMENT_STAGES.filter((s) => s !== "booked") as [
  "confirmed",
  ...("visa_processing" | "visa_issued" | "travel_confirmed" | "documents_ready" | "completed")[],
];
export const advanceDepartureSchema = z.object({ departureId: uuid, stage: z.enum(advanceStages) });

export const roomCreateSchema = z.object({
  departureId: uuid,
  city: z.enum(["makkah", "madinah"]),
  label: z.string().trim().min(1, "Enter a room number.").max(40),
  capacity: z.number().int().min(1, "Capacity must be 1 to 12.").max(12, "Capacity must be 1 to 12."),
  gender: z.enum(["male", "female", "family"]).nullable(),
});
export const roomRefSchema = z.object({ roomId: uuid });
export const roomAssignSchema = z.object({
  roomId: uuid,
  /** A pilgrim id, or `booking:<id>` for every pilgrim of one booking. */
  target: z.string().min(1, "Choose a pilgrim or booking."),
});
export const roomOccupantSchema = z.object({ roomId: uuid, pilgrimId: uuid });

// ---------------------------------------------------------------------------
// Admin — service catalog and private requests
// ---------------------------------------------------------------------------

export const serviceUpsertSchema = z.object({
  serviceId: uuid.optional(),
  category: z.enum(["hotel_makkah", "hotel_madinah", "flight", "visa", "transport", "intercity", "extra"]),
  name: z.string().trim().min(2, "Enter a name customers will recognise."),
  description: z.string().trim().max(500).optional(),
  tier: z.enum(["basic", "standard", "premium"]).nullable(),
  price: z.number().min(0, "Enter a price of zero or more."),
  priceUnit: z.enum(["per_person", "per_person_per_night", "per_night", "per_booking"]),
  starRating: z.number().int().min(0).max(5).nullable(),
  distanceToHaram: z.number().int().min(0).max(100000).nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  status: z.enum(["draft", "published", "suspended"]),
  /** Occupancy prices for hotels; null clears one. */
  sharingPrices: z.array(
    z.object({ sharing: z.number().int().min(1).max(4), price: z.number().positive("Room type prices must be greater than zero.").nullable() })
  ),
});
export type ServiceUpsertInput = z.infer<typeof serviceUpsertSchema>;
export const serviceRefSchema = z.object({ serviceId: uuid });

export const requestPriceSchema = z.object({
  bookingId: uuid,
  price: z.number().positive("Enter a price greater than zero."),
});
export const requestDecisionSchema = z.object({
  bookingId: uuid,
  status: z.enum(["confirmed", "cancelled"]),
  note: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Admin — fulfillment
// ---------------------------------------------------------------------------

export const umrahBookingsFilterSchema = z.object({
  stage: z.enum(UMRAH_FULFILLMENT_STAGES).optional(),
  departureId: uuid.optional(),
  packageId: uuid.optional(),
  payment: z.enum(["unpaid", "partial", "paid", "closed"]).optional(),
  page: z.number().int().min(1).default(1),
});
export type UmrahBookingsFilter = z.infer<typeof umrahBookingsFilterSchema>;

export const advanceStageSchema = z.object({
  bookingId: uuid,
  stage: z.enum(UMRAH_FULFILLMENT_STAGES),
  note: z.string().trim().max(500).optional(),
});
export const adminCancelBookingSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().min(1, "Enter a reason.").max(500, "Keep the reason under 500 characters."),
  refundAmount: z.number().min(0, "Enter a refund of zero or more.").optional(),
});
export const reviewDocumentSchema = z
  .object({
    documentId: uuid,
    decision: z.enum(["accepted", "rejected"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.decision === "accepted" || !!d.note, { message: "Enter a reason.", path: ["note"] });

export const segmentUpsertSchema = z
  .object({
    bookingId: uuid,
    segmentId: uuid.optional(),
    kind: z.enum(["flight", "hotel", "transfer", "train"]),
    title: z.string().trim().min(1, "Enter a title.").max(120, "Keep the title under 120 characters."),
    provider: z.string().trim().max(80).optional(),
    reference: z.string().trim().max(60).optional(),
    city: z.enum(["makkah", "madinah", "jeddah", "other"]).nullable(),
    startsAt: wallClock.nullable(),
    endsAt: wallClock.nullable(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt, { message: "End must be after the start.", path: ["endsAt"] });
export type SegmentUpsertInput = z.infer<typeof segmentUpsertSchema>;
export const segmentRefSchema = z.object({ segmentId: uuid });

export const staffDocTypeSchema = z.enum(UMRAH_STAFF_DOC_TYPES);

// ---------------------------------------------------------------------------
// Outputs (public)
// ---------------------------------------------------------------------------

const money = z.coerce.number();
const stringList = z
  .array(z.unknown())
  .catch([])
  .transform((items) => items.filter((v): v is string => typeof v === "string" && v.length > 0));

export const packageCardSchema = z.object({
  package_type: z.enum(["group", "private"]).default("group"),
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  tier: z.string().nullable(),
  isFeatured: z.boolean(),
  originIata: z.string().nullable(),
  destinationIata: z.string().nullable(),
  duration_days: z.coerce.number(),
  base_price: money,
  originalPrice: money.nullable(),
  currency: z.string(),
  includes: z.array(z.string()),
  /** Storage paths or absolute URLs; the web app resolves them. */
  images: z.array(z.string()),
  hotels: z.array(
    z.object({
      city: z.string(),
      name: z.string(),
      star_rating: z.coerce.number().nullable(),
      distance_to_haram_m: z.coerce.number().nullable(),
    })
  ),
  nextDeparture: z
    .object({
      departure_date: z.string(),
      total_seats: z.coerce.number(),
      booked_seats: z.coerce.number(),
      offline_seats: z.coerce.number(),
    })
    .nullable(),
});
export type PackageCard = z.infer<typeof packageCardSchema>;

const departurePublic = z.object({
  booking_mode: z.enum(["immediate_payment", "request_then_pay"]).optional(),
  formation_status: z.string().optional(),
  formation_closes_at: z.string().nullable().optional(),
  payment_cutoff_at: z.string().nullable().optional(),
  payment_window_hours: z.number().optional(),
  replacement_sales_open: z.boolean().optional(),
  request_terms: z.string().nullable().optional(),
  id: z.string(),
  departure_date: z.string(),
  return_date: z.string(),
  total_seats: z.coerce.number(),
  booked_seats: z.coerce.number(),
  offline_seats: z.coerce.number(),
  price_override: money.nullable(),
  sales_close_days: z.coerce.number().nullable(),
  status: z.string().nullable(),
  outbound_airline: z.string().nullable(),
  outbound_flight_number: z.string().nullable(),
  outbound_departs_at: z.string().nullable(),
  outbound_arrives_at: z.string().nullable(),
  return_airline: z.string().nullable(),
  return_flight_number: z.string().nullable(),
  return_departs_at: z.string().nullable(),
  return_arrives_at: z.string().nullable(),
  baggage_note: z.string().nullable(),
});

export const packageDetailSchema = z.object({
  package_type: z.enum(["group", "private"]).default("group"),
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  tagline: z.string().nullable(),
  tier: z.string().nullable(),
  is_featured: z.boolean(),
  origin_iata: z.string().nullable(),
  destination_iata: z.string().nullable(),
  duration_days: z.coerce.number(),
  includes: stringList,
  images: stringList,
  base_price: money,
  original_price: money.nullable(),
  currency: z.string(),
  status: z.string(),
  meal_plan: z.string().catch("none"),
  meals_note: z.string().nullable(),
  agent_contacts: z.array(publicUmrahAgentContactSchema).default([]),
  facilities: z.string().nullable().default(null),
  accommodation_details: z.string().nullable().default(null),
  flight_details: z.string().nullable().default(null),
  transport_details: z.string().nullable().default(null),
  nights_makkah: z.number().nullable().default(null),
  nights_madinah: z.number().nullable().default(null),
  contact_person_name: z.string().nullable(),
  contact_person_phone: z.string().nullable(),
  contact_person_email: z.string().nullable(),
  contact_whatsapp: z.string().nullable(),
  umrah_package_departures: z.array(departurePublic),
  umrah_package_hotels: z.array(
    z.object({
      id: z.string(),
      city: z.string(),
      name: z.string(),
      star_rating: z.coerce.number().nullable(),
      distance_to_haram_m: z.coerce.number().nullable(),
      nights: z.coerce.number().nullable(),
      room_type: z.string().nullable(),
      sort_order: z.coerce.number(),
    })
  ),
  umrah_itinerary_days: z.array(
    z.object({ id: z.string(), day_number: z.coerce.number(), title: z.string(), description: z.string().nullable() })
  ),
  umrah_package_pricing: z.array(z.object({ id: z.string(), sharing: z.coerce.number(), price: money })),
});
export type PackageDetail = z.infer<typeof packageDetailSchema>;

export const umrahServiceSchema = z.object({
  id: z.string(),
  category: z.enum(["hotel_makkah", "hotel_madinah", "flight", "visa", "transport", "intercity", "extra"]),
  name: z.string(),
  description: z.string().nullable(),
  tier: z.enum(["basic", "standard", "premium"]).nullable(),
  price: money,
  currency: z.string(),
  price_unit: z.enum(["per_person", "per_person_per_night", "per_night", "per_booking"]),
  star_rating: z.coerce.number().nullable(),
  distance_to_haram_m: z.coerce.number().nullable(),
  is_default: z.boolean(),
  sort_order: z.coerce.number(),
});

/** service id -> sharing (1-4) -> price per person per night. */
export const sharingPriceMapSchema = z.record(z.string(), z.record(z.string(), z.number()));

// ---------------------------------------------------------------------------
// Outputs (private trip)
// ---------------------------------------------------------------------------

const categoryEnum = z.enum(["hotel_makkah", "hotel_madinah", "flight", "visa", "transport", "intercity", "extra"]);
const priceUnitEnum = z.enum(["per_person", "per_person_per_night", "per_night", "per_booking"]);

export const customRequestSchema = z.object({
  package_snapshot: z.object({ packageId: z.string(), name: z.string(), origin: z.string(), destination: z.string(), departureDate: z.string(), returnDate: z.string(), includes: z.array(z.string()).default([]), images: z.array(z.string()).default([]) }).nullable().optional(),
  id: z.string(),
  reference: z.string(),
  status: z.string(),
  current_step: z.coerce.number(),
  tier: z.enum(["basic", "standard", "premium"]),
  num_pilgrims: z.coerce.number(),
  room_sharing: z.coerce.number(),
  departure_date: z.string().nullable(),
  nights_makkah: z.coerce.number(),
  nights_madinah: z.coerce.number(),
  notes: z.string().nullable(),
  pilgrims: z.unknown(),
  subtotal: z.coerce.number(),
  currency: z.string(),
  customer_id: z.string(),
  booked_by: z.string(),
  agency_id: z.string().nullable(),
  created_at: z.string(),
  services: z.array(
    z.object({
      id: z.string(),
      service_id: z.string().nullable(),
      category: categoryEnum,
      name: z.string(),
      price_unit: priceUnitEnum,
      unit_price: z.coerce.number(),
      quantity: z.coerce.number(),
      line_total: z.coerce.number(),
    })
  ),
});
export type CustomRequest = z.infer<typeof customRequestSchema>;

const oneOrMany = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]).nullable().transform((v) => (Array.isArray(v) ? (v[0] ?? null) : v));

export const submittedRequestSchema = customRequestSchema.extend({
  customer: oneOrMany(z.object({ full_name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() })),
  booking: oneOrMany(z.object({ id: z.string(), status: z.string(), total_price: z.coerce.number(), currency: z.string() })),
});
export type SubmittedRequest = z.infer<typeof submittedRequestSchema>;

export const draftRequestSchema = z.object({
  id: z.string(),
  reference: z.string(),
  current_step: z.coerce.number(),
  tier: z.enum(["basic", "standard", "premium"]),
  num_pilgrims: z.coerce.number(),
  departure_date: z.string().nullable(),
  nights_makkah: z.coerce.number(),
  nights_madinah: z.coerce.number(),
  subtotal: z.coerce.number(),
  currency: z.string(),
  updated_at: z.string(),
});
