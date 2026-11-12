/**
 * The traveller identity a booking needs, as stored on the agency customer
 * record. Client-safe on purpose: the desk picker, the context bar and the
 * server actions all judge "ready to book" by the same rules.
 */

/** Enough travellers for a coach; past this the desk is the wrong tool. */
export const MAX_BATCH_CUSTOMERS = 40;

export type TravellerProfile = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_issuing_country: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  preferred_cabin: string | null;
};

/** The name as printed in the passport, falling back to the display name. */
export function travellerName(traveller: Partial<TravellerProfile> & { full_name: string }) {
  return [traveller.first_name, traveller.middle_name, traveller.last_name].filter(Boolean).join(" ") || traveller.full_name;
}

export type PassportStatus = "missing" | "expired" | "expiring" | "valid";

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Most destinations refuse entry on a passport with under six months left. */
export function passportStatus(expiry: string | null | undefined, today = new Date()): PassportStatus {
  if (!expiry) return "missing";
  if (expiry <= isoDay(today)) return "expired";
  const limit = new Date(today);
  limit.setUTCMonth(limit.getUTCMonth() + 6);
  return expiry <= isoDay(limit) ? "expiring" : "valid";
}

/** Identity fields the booking still needs, in the order a form asks for them. */
export function travellerGaps(traveller: Partial<TravellerProfile>): string[] {
  const gaps: string[] = [];
  if (!traveller.gender) gaps.push("Gender");
  if (!traveller.date_of_birth) gaps.push("Date of birth");
  if (!traveller.nationality) gaps.push("Nationality");
  if (!traveller.passport_number) gaps.push("Passport number");
  if (!traveller.passport_expiry_date) gaps.push("Passport expiry");
  return gaps;
}

export function travellerReady(traveller: Partial<TravellerProfile>, today = new Date()) {
  return travellerGaps(traveller).length === 0 && passportStatus(traveller.passport_expiry_date, today) !== "expired";
}
