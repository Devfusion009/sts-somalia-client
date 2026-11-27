import { addCalendarDays } from "./itinerary";

/**
 * Umrah rules and vocabulary both apps must agree on: stage and document
 * labels, readiness codes, when travel documents unlock, which departures are
 * on sale, the operating settings, and the one-line messages the database's
 * raise texts map to.
 */

// ---------------------------------------------------------------------------
// Stages and documents
// ---------------------------------------------------------------------------

export const UMRAH_FULFILLMENT_STAGES = [
  "booked",
  "confirmed",
  "visa_processing",
  "visa_issued",
  "travel_confirmed",
  "documents_ready",
  "completed",
] as const;
export type UmrahFulfillmentStage = (typeof UMRAH_FULFILLMENT_STAGES)[number];

export const UMRAH_STAGE_LABEL: Record<UmrahFulfillmentStage, string> = {
  booked: "Booking received",
  confirmed: "Confirmed",
  visa_processing: "Visa processing",
  visa_issued: "Visa issued",
  travel_confirmed: "Travel confirmed",
  documents_ready: "Documents ready",
  completed: "Completed",
};

export const UMRAH_STAFF_DOC_TYPES = ["visa", "e_ticket", "hotel_voucher", "itinerary", "insurance", "other"] as const;
export type UmrahStaffDocType = (typeof UMRAH_STAFF_DOC_TYPES)[number];

export const UMRAH_DOC_TYPE_LABEL: Record<string, string> = {
  visa: "Visa",
  e_ticket: "E-ticket",
  hotel_voucher: "Hotel voucher",
  itinerary: "Itinerary",
  insurance: "Insurance",
  other: "Document",
};

/** Customer hand-in document types and labels. */
export const HAND_IN_TYPES = ["passport_copy", "photo", "vaccination", "national_id"] as const;
export type HandInType = (typeof HAND_IN_TYPES)[number];

export const HAND_IN_LABEL: Record<HandInType, string> = {
  passport_copy: "Passport copy",
  photo: "Photo",
  vaccination: "Vaccination certificate",
  national_id: "National ID",
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "In review",
  accepted: "Accepted",
  rejected: "Rejected",
};

/** Labels for umrah_pilgrim_readiness's missing / warnings codes. */
export const READINESS_LABEL: Record<string, string> = {
  passport_number: "Passport missing",
  passport_expiry: "Passport expiry missing",
  passport_expires_too_soon: "Passport expires too soon",
  date_of_birth: "Date of birth missing",
  nationality: "Nationality missing",
  "document:passport_copy": "Passport copy missing",
  "document:photo": "Photo missing",
  "document:vaccination": "Vaccination missing",
  "document:national_id": "National ID missing",
  mahram_missing: "Mahram missing",
};

export type PilgrimReadiness = { missing: string[]; warnings: string[] };

export function readinessLabel(code: string) {
  return READINESS_LABEL[code] ?? code.replace(/_/g, " ");
}

export const MEAL_PLAN_LABELS: Record<string, string> = {
  none: "No meals included",
  breakfast: "Breakfast only",
  half_board: "Half board (breakfast + dinner)",
  full_board: "Full board (all meals)",
};

export function sharingLabel(sharing: number): string {
  if (sharing === 1) return "Single occupancy";
  if (sharing === 2) return "Double sharing";
  if (sharing === 3) return "Triple sharing";
  if (sharing === 4) return "Quad sharing";
  return `${sharing} sharing`;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

const PAID_ORDER = ["paid", "processing", "completed"];
const STAGES_WITH_TRAVEL = ["travel_confirmed", "documents_ready", "completed"];

/**
 * The voucher and the itinerary PDF unlock when the order is fully paid and
 * an Umrah booking has reached 'travel_confirmed' (flights and hotels final).
 */
export function umrahVoucherAvailable(orderStatus: string, umrahStage?: string | null) {
  if (!PAID_ORDER.includes(orderStatus)) return false;
  if (umrahStage === undefined) return true;
  return !!umrahStage && STAGES_WITH_TRAVEL.includes(umrahStage);
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Departures still on sale, soonest first: open, and departing after the
 * departure's own sales cutoff (departure_date - sales_close_days > today).
 * create_umrah_group_booking applies the same rule in SQL.
 */
export function bookableDepartures<
  T extends { departure_date: string; sales_close_days?: number | null; status?: string | null; booking_mode?: string; formation_status?: string; formation_closes_at?: string | null; payment_cutoff_at?: string | null; payment_window_hours?: number; replacement_sales_open?: boolean },
>(departures: T[], today = localToday()): T[] {
  return departures
    .filter((d) => d.booking_mode !== "request_then_pay" ||
      (d.formation_status === "forming" && !!d.formation_closes_at && Date.parse(d.formation_closes_at) > Date.now()) ||
      (d.formation_status === "payment_open" && d.replacement_sales_open && !!d.payment_cutoff_at && Date.now() + (d.payment_window_hours ?? 48) * 3_600_000 <= Date.parse(d.payment_cutoff_at)))
    .filter((d) => (d.status ?? "open") === "open")
    .filter((d) => {
      const [y, m, day] = d.departure_date.split("-").map(Number);
      const close = new Date(Date.UTC(y, m - 1, day - (d.sales_close_days ?? 0))).toISOString().slice(0, 10);
      return close > today;
    })
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date));
}

// ---------------------------------------------------------------------------
// Operating settings (platform_settings 'umrah_operations')
// ---------------------------------------------------------------------------

export type UmrahOperations = {
  /** Hours an unpaid group booking holds its seats before it is released. */
  unpaidHoldHours: number;
  privateDepositPercent: number;
  privateBalanceDueDays: number;
  /** Minimum days between today and a private trip's departure. */
  privateLeadDays: number;
  privateFullPaymentBeforeDocuments: boolean;
  /** Refuse 'visa_processing' while a pilgrim is missing passport data. */
  visaRequiresPassport: boolean;
  requiredDocuments: HandInType[];
};

/** Mirror the SQL fallbacks in umrah_setting(), so app and database agree when a key is missing. */
export const UMRAH_OPERATIONS_DEFAULTS: UmrahOperations = {
  unpaidHoldHours: 48,
  privateDepositPercent: 50,
  privateBalanceDueDays: 30,
  privateLeadDays: 0,
  privateFullPaymentBeforeDocuments: true,
  visaRequiresPassport: true,
  requiredDocuments: [],
};

function num(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Reads the stored settings row, falling back key by key. */
export function parseUmrahOperations(raw: Record<string, unknown> | null | undefined): UmrahOperations {
  const r = raw ?? {};
  const d = UMRAH_OPERATIONS_DEFAULTS;
  return {
    unpaidHoldHours: num(r.unpaidHoldHours, d.unpaidHoldHours),
    privateDepositPercent: num(r.privateDepositPercent, d.privateDepositPercent),
    privateBalanceDueDays: num(r.privateBalanceDueDays, d.privateBalanceDueDays),
    privateLeadDays: num(r.privateLeadDays, d.privateLeadDays),
    privateFullPaymentBeforeDocuments:
      typeof r.privateFullPaymentBeforeDocuments === "boolean"
        ? r.privateFullPaymentBeforeDocuments
        : d.privateFullPaymentBeforeDocuments,
    visaRequiresPassport: typeof r.visaRequiresPassport === "boolean" ? r.visaRequiresPassport : d.visaRequiresPassport,
    requiredDocuments: Array.isArray(r.requiredDocuments)
      ? r.requiredDocuments.filter((t): t is HandInType => (HAND_IN_TYPES as readonly string[]).includes(String(t)))
      : d.requiredDocuments,
  };
}

/** A private trip must leave after today plus the configured lead time; null when it does. */
export function privateDepartureLeadError(departureDate: string, privateLeadDays: number, today = localToday()) {
  const earliest = addCalendarDays(today, Math.max(privateLeadDays, 0) + 1);
  if (departureDate >= earliest) return null;
  return privateLeadDays > 0
    ? `Choose a departure at least ${privateLeadDays + 1} days from today.`
    : "Choose a departure date after today.";
}

// ---------------------------------------------------------------------------
// Database raise texts -> one plain line
// ---------------------------------------------------------------------------

export const REQUEST_NOT_EDITABLE_ERROR =
  "This trip is no longer editable — it may already have been submitted or discarded. Start a new one below.";

/** create_umrah_group_booking. */
export function groupBookingErrorMessage(message: string | undefined) {
  if (!message) return "Could not create the booking.";
  if (message.includes("not enough seats left")) return "Not enough seats left on this departure.";
  if (message.includes("bookings for this departure are closed")) return "Bookings for this departure are closed.";
  if (message.includes("select a room sharing option")) return "Select a room sharing option.";
  if (message.includes("departure not found")) return "That departure could not be found.";
  if (message.includes("full name")) return "Enter each pilgrim's full name.";
  if (message.includes("do not match")) return "Add details for every pilgrim.";
  if (message.includes("already exists")) return "These travellers already have a request for these dates.";
  if (message.includes("route is incomplete")) return "This package is not available for booking.";
  return "Could not create the booking.";
}

/** update_umrah_pilgrim. */
export function pilgrimErrorMessage(message: string) {
  if (message.includes("locked")) return "Pilgrim details are locked while visas are processed.";
  if (message.includes("not found")) return "Pilgrim not found.";
  if (message.includes("full name")) return "Enter the pilgrim's full name.";
  if (message.includes("gender")) return "Choose a gender.";
  return "Could not update the pilgrim.";
}

/** set_umrah_booking_stage. */
export function stageErrorMessage(message: string) {
  if (message.includes("has not been paid")) return "This booking has not been paid yet.";
  if (message.includes("not fully paid")) return "This booking is not fully paid.";
  if (message.includes("pilgrim details incomplete")) return "Pilgrim details are incomplete.";
  if (message.includes("cannot move back")) return "Stages can only move forward.";
  if (message.includes("not found")) return "Booking not found.";
  const status = message.match(/this booking is (\w+)/);
  if (status) return `This booking is ${status[1]}.`;
  if (message.includes("only STS staff")) return "Only STS staff can change the stage.";
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/** Room occupant trigger. */
export function roomErrorMessage(message: string) {
  if (message.includes("room is full")) return "This room is full.";
  if (message.includes("already has a room")) return "A pilgrim already has a room in this city.";
  if (message.includes("not on this departure")) return "That pilgrim is not on this departure.";
  return "The room could not be updated.";
}

/** umrah_package_departures constraints. */
export function departureErrorMessage(error: { message: string; code?: string }) {
  if (error.message.includes("seats_within_total")) return "Seats sold exceed total seats.";
  if (error.message.includes("umrah_package_departures_check")) return "Return date must be after the departure date.";
  if (error.code === "23503") return "This departure has bookings and cannot be deleted.";
  return "The departure could not be saved.";
}
