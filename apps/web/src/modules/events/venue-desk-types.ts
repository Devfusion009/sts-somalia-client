/**
 * Shared shapes for the venue booking desk. Kept out of
 * venue-manager-actions.ts: a "use server" module may only export async
 * functions.
 */
import { format, parseISO } from "date-fns";

export { OFFLINE_PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type OfflinePaymentMethod } from "@/modules/hotels/reservation-types";

/** Statuses a manager can move a booking to. */
export const DESK_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
export type DeskStatus = (typeof DESK_STATUSES)[number];

export type VenueBookingResult =
  | { error: string }
  | { error: null; bookingId: string; bookingRef: string; status: "confirmed" | "waitlisted" };

export const HALL_STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
};

/** "18:30:00" → "18:30"; null stays null. */
export function shortTime(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

function slotDay(iso: string, withYear: boolean): string {
  return format(parseISO(iso), withYear ? "d MMM yyyy" : "d MMM");
}

/** "10 Mar 2027" or "10 Mar → 12 Mar 2027", with times when set. */
export function hallSlotLabel(b: {
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}): string {
  const dates =
    b.start_date === b.end_date
      ? slotDay(b.start_date, true)
      : `${slotDay(b.start_date, b.start_date.slice(0, 4) !== b.end_date.slice(0, 4))} → ${slotDay(b.end_date, true)}`;
  const from = shortTime(b.start_time);
  const to = shortTime(b.end_time);
  return from && to ? `${dates} · ${from}–${to}` : from ? `${dates} · from ${from}` : dates;
}
