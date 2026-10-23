import {
  UMRAH_CATEGORY_BY_VALUE,
  type RoomSharing,
  type UmrahPriceUnit,
  type UmrahService,
  type UmrahServiceCategory,
} from "./catalog";

/**
 * The private Umrah pricing engine.
 *
 * Deliberately pure and dependency-free so the SAME code runs in the browser
 * (the builder's running total updates on every click, with no round trip)
 * and on the server (submit recomputes from the catalog and never trusts a
 * number that arrived in a form field). A second, "close enough" copy of this
 * arithmetic on the client is how a customer ends up agreeing to one total
 * and being charged another.
 */

export type TripShape = {
  numPilgrims: number;
  nightsMakkah: number;
  nightsMadinah: number;
};

/** Nights that a per-night price is multiplied over, for this category. */
export function nightsForCategory(category: UmrahServiceCategory, trip: TripShape): number {
  switch (UMRAH_CATEGORY_BY_VALUE.get(category)?.nights) {
    case "makkah":
      return trip.nightsMakkah;
    case "madinah":
      return trip.nightsMadinah;
    default:
      return trip.nightsMakkah + trip.nightsMadinah;
  }
}

/**
 * How many units of a service the trip consumes. Never entered by hand —
 * it falls out of the party size and the nights in each city, which is what
 * makes the total recompute correctly the moment either changes.
 */
export function serviceQuantity(
  unit: UmrahPriceUnit,
  category: UmrahServiceCategory,
  trip: TripShape
): number {
  switch (unit) {
    case "per_person":
      return Math.max(1, trip.numPilgrims);
    case "per_person_per_night":
      return Math.max(1, trip.numPilgrims) * Math.max(0, nightsForCategory(category, trip));
    case "per_night":
      return Math.max(0, nightsForCategory(category, trip));
    case "per_booking":
      return 1;
  }
}

export type PricedLine = {
  serviceId: string;
  category: UmrahServiceCategory;
  name: string;
  priceUnit: UmrahPriceUnit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

/**
 * Per-occupancy hotel prices, keyed service id -> sharing (1-4) -> price per
 * person per night. Built from umrah_service_sharing_prices rows.
 */
export type SharingPriceMap = Record<string, Partial<Record<RoomSharing, number>>>;

/** The room type a request is priced at, plus the catalog's occupancy prices. */
export type SharingContext = {
  roomSharing: RoomSharing;
  sharingPrices: SharingPriceMap;
};

export function toSharingPriceMap(
  rows: { service_id: string; sharing: number; price: number | string }[]
): SharingPriceMap {
  const map: SharingPriceMap = {};
  for (const row of rows) {
    if (!isRoomSharing(row.sharing)) continue;
    (map[row.service_id] ??= {})[row.sharing] = Number(row.price);
  }
  return map;
}

export function isRoomSharing(value: unknown): value is RoomSharing {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Only hotels are priced by occupancy; every other category has one price. */
export function isSharingPricedCategory(category: UmrahServiceCategory): boolean {
  return category === "hotel_makkah" || category === "hotel_madinah";
}

/**
 * The unit price a service is charged at for this room type: the occupancy
 * price when the catalog has one for this sharing, otherwise the service's
 * base price. The single place this rule lives — the builder's live total and
 * the server's reprice both call it.
 */
export function unitPriceFor(
  service: Pick<UmrahService, "id" | "category" | "price">,
  sharing?: SharingContext
): number {
  const base = Number(service.price);
  if (!sharing || !isSharingPricedCategory(service.category)) return base;
  const occupancy = sharing.sharingPrices[service.id]?.[sharing.roomSharing];
  return occupancy !== undefined && Number.isFinite(occupancy) && occupancy > 0
    ? Number(occupancy)
    : base;
}

export function priceService(
  service: UmrahService,
  trip: TripShape,
  sharing?: SharingContext
): PricedLine {
  const quantity = serviceQuantity(service.price_unit, service.category, trip);
  const unitPrice = unitPriceFor(service, sharing);
  return {
    serviceId: service.id,
    category: service.category,
    name: service.name,
    priceUnit: service.price_unit,
    unitPrice,
    quantity,
    // Rounded to cents at the line, not at the end: the stored line_total and
    // the displayed line have to be the same number, and the order total is
    // the sum of what the customer saw.
    lineTotal: round2(unitPrice * quantity),
  };
}

/**
 * Prices a whole selection. Zero-quantity lines are dropped — a Makkah hotel
 * chosen and then reduced to 0 nights costs nothing and must not appear on
 * the summary as a free line item.
 */
export function priceSelection(
  services: UmrahService[],
  trip: TripShape,
  sharing?: SharingContext
) {
  const lines = services
    .map((s) => priceService(s, trip, sharing))
    .filter((l) => l.quantity > 0);
  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines, total };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Total trip length in days. Nights in both cities plus the day you land —
 * the same "N nights = N+1 days" convention umrah_packages.duration_days uses
 * on the group side, so the two flows quote lengths comparably.
 */
export function tripDurationDays(trip: TripShape): number {
  const nights = trip.nightsMakkah + trip.nightsMadinah;
  return nights > 0 ? nights + 1 : 0;
}

export function tripReturnDate(departureDate: string | null, trip: TripShape): string | null {
  if (!departureDate) return null;
  const nights = trip.nightsMakkah + trip.nightsMadinah;
  const date = new Date(`${departureDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + nights);
  // Formatted from the LOCAL parts, not toISOString(). The date is parsed as
  // local midnight, so in any timezone ahead of UTC toISOString() rolls it
  // back a day: a customer in Mogadishu (UTC+3) departing 10 Nov for 8 nights
  // was shown a return of 17 Nov instead of 18 Nov.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Formats money the way every Umrah surface does: no cents on whole amounts,
 * always grouped. Grouping has to apply to BOTH branches — a summary showing
 * "USD 3,917" next to "USD 1305.67 per traveller" reads as two different
 * currencies, which is what toFixed(2) alone produced here.
 */
export function formatUmrahMoney(amount: number, currency: string): string {
  const rounded = round2(amount);
  const decimals = Number.isInteger(rounded) ? 0 : 2;
  return `${currency} ${rounded.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
