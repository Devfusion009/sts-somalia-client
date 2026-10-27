/**
 * Shared by the hotel page, the booking page, the booking action and the
 * consoles: how a stay's occupancy travels in a URL, what each rate plan and
 * extra is called, and the price formula. The formula mirrors
 * quote_hotel_stay() in the database, which is what actually charges.
 */

export type RoomOccupancy = { adults: number; children: number };

export const OCCUPANCY_LIMITS = { rooms: 10, adults: 8, children: 4 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** "2-1,2-0" → two rooms: 2 adults + 1 child, 2 adults. Falls back to one room for `fallbackGuests` adults. */
export function parseOccupancy(raw: string | null | undefined, fallbackGuests?: number): RoomOccupancy[] {
  const rooms = (raw ?? "")
    .split(",")
    .map((part) => /^(\d{1,2})-(\d{1,2})$/.exec(part.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .slice(0, OCCUPANCY_LIMITS.rooms)
    .map((m) => ({
      adults: clamp(Number(m[1]), 1, OCCUPANCY_LIMITS.adults),
      children: clamp(Number(m[2]), 0, OCCUPANCY_LIMITS.children),
    }));
  if (rooms.length > 0) return rooms;
  const adults = Number.isFinite(fallbackGuests) && fallbackGuests ? clamp(Math.round(fallbackGuests), 1, OCCUPANCY_LIMITS.adults) : 2;
  return [{ adults, children: 0 }];
}

export function formatOccupancy(rooms: RoomOccupancy[]): string {
  return rooms.map((r) => `${r.adults}-${r.children}`).join(",");
}

export function occupancyTotals(rooms: RoomOccupancy[]) {
  const adults = rooms.reduce((sum, r) => sum + r.adults, 0);
  const children = rooms.reduce((sum, r) => sum + r.children, 0);
  return { rooms: rooms.length, adults, children, guests: adults + children };
}

/** "4 adults, 1 child · 2 rooms" */
export function occupancySummary(rooms: RoomOccupancy[]): string {
  const t = occupancyTotals(rooms);
  const people = [`${t.adults} adult${t.adults === 1 ? "" : "s"}`];
  if (t.children > 0) people.push(`${t.children} child${t.children === 1 ? "" : "ren"}`);
  return `${people.join(", ")} · ${t.rooms} room${t.rooms === 1 ? "" : "s"}`;
}

export type BoardBasis = "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive";

export const BOARD_LABEL: Record<BoardBasis, string> = {
  room_only: "Room only",
  breakfast: "Bed and breakfast",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All inclusive",
};

export const BOARD_OPTIONS = Object.keys(BOARD_LABEL) as BoardBasis[];

export type Cancellation = "flexible" | "non_refundable";

export type RatePlan = {
  id: string;
  name: string;
  board: BoardBasis;
  boardPriceAdult: number;
  boardPriceChild: number;
  cancellation: Cancellation;
  freeCancelDays: number | null;
  discountPercent: number;
  isActive: boolean;
};

export type ExtraUnit = "per_stay" | "per_night" | "per_guest" | "per_guest_night";

export const EXTRA_UNIT_LABEL: Record<ExtraUnit, string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_guest: "per guest",
  per_guest_night: "per guest per night",
};

export const EXTRA_UNIT_OPTIONS = Object.keys(EXTRA_UNIT_LABEL) as ExtraUnit[];

export type HotelExtra = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: ExtraUnit;
  isActive: boolean;
};

export function isBoardBasis(value: unknown): value is BoardBasis {
  return typeof value === "string" && value in BOARD_LABEL;
}

export function isExtraUnit(value: unknown): value is ExtraUnit {
  return typeof value === "string" && value in EXTRA_UNIT_LABEL;
}

/** Last day the stay can be cancelled free of charge: check-in minus the plan's free days. */
export function freeCancellationDeadline(checkIn: string, freeCancelDays: number): string {
  const date = new Date(`${checkIn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - freeCancelDays);
  return date.toISOString().slice(0, 10);
}

const deadlineFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Free cancellation until 30 Oct", "Free cancellation" (no dates yet) or "Non-refundable". */
export function cancellationLabel(
  plan: { cancellation: Cancellation; freeCancelDays: number | null },
  checkIn?: string | null
): string {
  if (plan.cancellation === "non_refundable") return "Non-refundable";
  if (!checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || plan.freeCancelDays === null) return "Free cancellation";
  const deadline = freeCancellationDeadline(checkIn, plan.freeCancelDays);
  return `Free cancellation until ${deadlineFormat.format(new Date(`${deadline}T00:00:00Z`))}`;
}

/** Whether today is already past a flexible plan's free window (so the guest books it as non-refundable in effect). */
export function freeWindowClosed(plan: { cancellation: Cancellation; freeCancelDays: number | null }, checkIn: string, today: string) {
  if (plan.cancellation !== "flexible" || plan.freeCancelDays === null) return false;
  return today > freeCancellationDeadline(checkIn, plan.freeCancelDays);
}

/** Same formula as quote_hotel_stay(), for list prices before the booking page asks the database. */
export function planStayPrice(args: {
  roomStay: number;
  rooms: number;
  nights: number;
  adults: number;
  children: number;
  plan: Pick<RatePlan, "discountPercent" | "boardPriceAdult" | "boardPriceChild"> | null;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const roomsTotal = round(args.roomStay * args.rooms);
  if (!args.plan) return { roomsTotal, discount: 0, board: 0, total: roomsTotal };
  const discount = round((roomsTotal * args.plan.discountPercent) / 100);
  const board = round(args.nights * (args.adults * args.plan.boardPriceAdult + args.children * args.plan.boardPriceChild));
  return { roomsTotal, discount, board, total: round(roomsTotal - discount + board) };
}

/** The booking's rate plan snapshot (hotel_bookings.rate_plan) in app shape. */
export function readRatePlanSnapshot(value: unknown): (Pick<RatePlan, "name" | "board" | "cancellation" | "freeCancelDays" | "discountPercent">) | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || !isBoardBasis(v.board)) return null;
  return {
    name: v.name,
    board: v.board,
    cancellation: v.cancellation === "non_refundable" ? "non_refundable" : "flexible",
    freeCancelDays: typeof v.free_cancel_days === "number" ? v.free_cancel_days : null,
    discountPercent: Number(v.discount_percent ?? 0),
  };
}

export type BookedExtra = { id: string; name: string; unit: ExtraUnit; unitPrice: number; quantity: number; total: number };

/** The booking's extras snapshot (hotel_bookings.extras) in app shape. */
export function readExtrasSnapshot(value: unknown): BookedExtra[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.name !== "string" || !isExtraUnit(v.unit)) return [];
    return [{
      id: v.id,
      name: v.name,
      unit: v.unit,
      unitPrice: Number(v.unit_price ?? 0),
      quantity: Number(v.quantity ?? 1),
      total: Number(v.total ?? 0),
    }];
  });
}

export const ARRIVAL_TIME_OPTIONS = [
  "00:00–01:00", "01:00–02:00", "02:00–03:00", "03:00–04:00", "04:00–05:00", "05:00–06:00",
  "06:00–07:00", "07:00–08:00", "08:00–09:00", "09:00–10:00", "10:00–11:00", "11:00–12:00",
  "12:00–13:00", "13:00–14:00", "14:00–15:00", "15:00–16:00", "16:00–17:00", "17:00–18:00",
  "18:00–19:00", "19:00–20:00", "20:00–21:00", "21:00–22:00", "22:00–23:00", "23:00–00:00",
] as const;

export const ROOM_PREFERENCES = {
  bed: { label: "Bed type", options: ["Double bed", "Twin beds"] },
  smoking: { label: "Smoking", options: ["Non-smoking", "Smoking"] },
  cot: { label: "Baby cot", options: ["Baby cot needed"] },
  location: { label: "Room location", options: ["High floor", "Low floor", "Quiet room", "Near the lift"] },
} as const;

export type RoomPreferenceKey = keyof typeof ROOM_PREFERENCES;

export type StayDetails = {
  arrival_time?: string;
  purpose?: "leisure" | "business";
  booked_for_other?: boolean;
  lead_guest?: { name: string; phone?: string };
  preferences?: Array<Partial<Record<RoomPreferenceKey, string>>>;
};

/** hotel_bookings.stay_details in app shape, keeping only known keys. */
export function readStayDetails(value: unknown): StayDetails {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const out: StayDetails = {};
  if (typeof v.arrival_time === "string") out.arrival_time = v.arrival_time;
  if (v.purpose === "leisure" || v.purpose === "business") out.purpose = v.purpose;
  if (v.booked_for_other === true) out.booked_for_other = true;
  const lead = v.lead_guest as Record<string, unknown> | undefined;
  if (lead && typeof lead.name === "string") {
    out.lead_guest = { name: lead.name, ...(typeof lead.phone === "string" ? { phone: lead.phone } : {}) };
  }
  if (Array.isArray(v.preferences)) {
    out.preferences = v.preferences.map((p) => {
      const pref: Partial<Record<RoomPreferenceKey, string>> = {};
      if (p && typeof p === "object") {
        for (const key of Object.keys(ROOM_PREFERENCES) as RoomPreferenceKey[]) {
          const value = (p as Record<string, unknown>)[key];
          if (typeof value === "string") pref[key] = value;
        }
      }
      return pref;
    });
  }
  return out;
}
