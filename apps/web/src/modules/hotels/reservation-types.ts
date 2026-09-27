/**
 * Shared shapes for the offline reservation flow. Kept out of
 * reservation-actions.ts on purpose: a "use server" module may only export
 * async functions, so the constant and types below would break the build
 * there (see gallery-targets.ts for the same split).
 */

export const OFFLINE_PAYMENT_METHODS = ["cash", "card", "mobile_money", "bank_transfer"] as const;
export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<OfflinePaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
};

export type QuotedRoom = {
  id: string;
  name: string;
  currency: string;
  maxOccupancy: number;
  nightlyRate: number;
  /** Whole-stay price for one room, per-date overrides included. */
  stayPricePerRoom: number;
  /** Lowest rooms-left figure across the stay; null when the room count isn't tracked. */
  available: number | null;
};

export type StayQuote = {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: QuotedRoom[];
};

export type ReservationResult =
  | { error: string }
  | { error: null; bookingId: string; status: "confirmed" | "waitlisted" };
