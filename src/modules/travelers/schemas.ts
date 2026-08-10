import { z } from "zod";
import { RELATIONSHIPS } from "@/modules/visa/schemas";

/**
 * Traveler identity + passport validation.
 *
 * RELATIONSHIPS is imported from the visa module rather than redeclared: a
 * saved traveler exists to prefill a visa member row, so the two vocabularies
 * must be the same list, not two lists that happen to agree today.
 */

/**
 * Months of passport validity most destinations require BEYOND the date of
 * entry. Six is the near-universal rule across the Gulf, Schengen, Türkiye and
 * East Africa; applying anything shorter would leave the customer confidently
 * holding a passport that gets their visa refused.
 */
export const PASSPORT_VALIDITY_MONTHS = 6;

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

/** Empty strings from an untouched <input> mean "not provided", not "invalid". */
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
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the full name exactly as printed in the passport."),
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
  // Mirrors the traveler_passport_dates_ordered CHECK constraint so the user
  // gets a field-level message instead of a raw Postgres constraint violation.
  .refine(
    (v) =>
      !v.passportIssueDate ||
      !v.passportExpiry ||
      new Date(v.passportIssueDate) < new Date(v.passportExpiry),
    { message: "The passport issue date must be before its expiry date.", path: ["passportIssueDate"] }
  )
  // A date of birth in the future is always a typo, and it silently breaks the
  // age-based pricing that Umrah packages use.
  .refine((v) => !v.dateOfBirth || new Date(v.dateOfBirth) <= new Date(), {
    message: "The date of birth cannot be in the future.",
    path: ["dateOfBirth"],
  });

export type TravelerInput = z.infer<typeof travelerSchema>;

export type PassportStatus =
  | { level: "none" }
  | { level: "expired"; daysRemaining: number; expiry: string }
  | { level: "expiring"; daysRemaining: number; monthsRemaining: number; expiry: string }
  | { level: "valid"; daysRemaining: number; expiry: string };

/**
 * Classifies a passport expiry date for the warning UI.
 *
 * Compared at whole-day granularity against UTC midnight so the result doesn't
 * flip based on what time of day the page is rendered — a passport does not
 * become "expiring" at 14:00 and "valid" again at midnight.
 */
export function passportStatus(expiry: string | null | undefined): PassportStatus {
  if (!expiry) return { level: "none" };

  const expiryMs = Date.parse(`${expiry.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiryMs)) return { level: "none" };

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.round((expiryMs - todayMs) / 86_400_000);

  if (daysRemaining < 0) return { level: "expired", daysRemaining, expiry };

  // Calendar-month arithmetic, not days/30: "6 months from 31 August" is
  // 28 February, and a day-count approximation gets that boundary wrong.
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
