import { z } from "zod";
import { CURRENT_YEAR, EARLIEST_BUSINESS_YEAR } from "./config";

/**
 * "+<dial code><6-10 digit local number>", produced by PhoneField
 * (components/phone-field.tsx). Lives here, not in actions.ts, because a
 * "use server" file may only export async functions — a Zod schema export
 * breaks the build the moment a second module needs to import it too.
 */
export const phoneSchema = z
  .string()
  .min(1, "Enter a phone number.")
  .regex(/^\+\d{1,4}\d{6,10}$/, "Enter a valid phone number.");

/*
 * Field rules for every wizard step. Shared by the server actions, which
 * enforce them, and the wizard, which checks a field as soon as the applicant
 * leaves it, so both always report the same message.
 */

const LETTERS = /\p{L}/u;
const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u;
const PLACE_CHARS = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9'’.,()\- ]*$/u;

/** An optional text field: empty passes, anything typed must satisfy `check`. */
function optionalText(max: number, check?: { pattern: RegExp; message: string }) {
  return z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .refine((v) => v === "" || !check || check.pattern.test(v), check?.message ?? "")
    .optional();
}

function wholeNumber(min: number, max: number, empty: string, invalid: string) {
  return z
    .string()
    .trim()
    .min(1, empty)
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, invalid);
}

function optionalWholeNumber(min: number, max: number, invalid: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), invalid)
    .optional();
}

export const personNameSchema = z
  .string()
  .trim()
  .min(1, "Enter the full name.")
  .max(80, "Use 80 characters or fewer.")
  .regex(NAME_CHARS, "Use letters only.")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Enter first and last name.");

export const idNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter the ID or passport number.")
  .regex(/^[A-Za-z0-9-]{5,20}$/, "Use 5 to 20 letters or digits.")
  .refine((v) => /\d/.test(v), "Enter a valid ID or passport number.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .max(254, "Use 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));

const businessNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the business name.")
  .max(120, "Use 120 characters or fewer.")
  .regex(LETTERS, "Enter a valid business name.");

const citySchema = z
  .string()
  .trim()
  .min(2, "Enter the city.")
  .max(80, "Use 80 characters or fewer.")
  .regex(PLACE_CHARS, "Enter a valid city.");

const referenceNumber = optionalText(30, {
  pattern: /^[A-Za-z0-9][A-Za-z0-9/.\- ]{2,29}$/,
  message: "Use 3 to 30 letters, digits, / or -.",
});

const bankName = (required: boolean) =>
  required
    ? z.string().trim().min(2, "Enter the bank name.").max(80, "Use 80 characters or fewer.").regex(LETTERS, "Enter a valid bank name.")
    : optionalText(80, { pattern: LETTERS, message: "Enter a valid bank name." });

const accountName = (required: boolean) =>
  required
    ? z.string().trim().min(2, "Enter the account holder name.").max(80, "Use 80 characters or fewer.").regex(NAME_CHARS, "Use letters only.")
    : optionalText(80, { pattern: NAME_CHARS, message: "Use letters only." });

const ACCOUNT_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 -]{4,33}$/;
const accountNumber = (required: boolean) =>
  required
    ? z.string().trim().min(1, "Enter the account number.").regex(ACCOUNT_NUMBER, "Enter a valid account number or IBAN.")
    : optionalText(34, { pattern: ACCOUNT_NUMBER, message: "Enter a valid account number or IBAN." });

/** "example.com" and "https://example.com" both pass; the server stores the https form. */
export function normalizeWebsite(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const websiteSchema = z
  .string()
  .trim()
  .max(200, "Use 200 characters or fewer.")
  .refine((v) => v === "" || normalizeWebsite(v) !== null, "Enter a valid website, e.g. example.com.")
  .optional();

export const step1BusinessSchema = z.object({
  legalBusinessName: businessNameSchema,
  tradingName: optionalText(120, { pattern: LETTERS, message: "Enter a valid trading name." }),
  businessType: z.string().min(1, "Select a business type."),
  yearEstablished: z
    .string()
    .trim()
    .min(1, "Enter the year your business was established.")
    .refine((v) => {
      const year = Number(v);
      return Number.isInteger(year) && year >= EARLIEST_BUSINESS_YEAR && year <= CURRENT_YEAR;
    }, `Enter a year between ${EARLIEST_BUSINESS_YEAR} and ${CURRENT_YEAR}.`),
  registrationNumber: referenceNumber,
  taxId: referenceNumber,
  officeStreet: optionalText(200, { pattern: PLACE_CHARS, message: "Enter a valid street address." }),
  officeCity: citySchema,
  officeRegion: optionalText(80, { pattern: PLACE_CHARS, message: "Enter a valid region." }),
  officeCountry: z.string().trim().max(80).optional(),
  businessPhone: phoneSchema,
  businessEmail: emailSchema,
  website: websiteSchema,
  branchesJson: z.string().optional(),
});

// An affiliate is an individual referring an existing B2C platform, not a
// registered business — no legal name/tax ID/office address, just who they
// are, how to reach them, and where their audience actually is.
export const step1AffiliateSchema = z.object({
  fullName: personNameSchema,
  city: citySchema,
  audienceLocation: z.string().min(1, "Select where your audience is mainly based."),
  mobile: phoneSchema,
  email: emailSchema,
});

export const step2ContactSchema = z.object({
  contactFullName: personNameSchema,
  contactRole: z
    .string()
    .trim()
    .min(2, "Enter the role or title.")
    .max(60, "Use 60 characters or fewer.")
    .regex(LETTERS, "Enter a valid role or title."),
  contactIdNumber: idNumberSchema,
  contactMobile: phoneSchema,
  contactEmail: emailSchema,
});

// The affiliate already gave their name/phone/email in step 1 — step 2 here
// exists purely to record the ID number backing the document they'll upload
// in the Documents step, for payout fraud prevention.
export const step2AffiliateSchema = z.object({
  idNumber: idNumberSchema,
});

export const step3AgencySchema = z.object({
  yearsExperience: optionalText(20),
  staffCount: optionalText(20),
  monthlyVolume: z.string().min(1, "Select an estimated monthly volume."),
  products: z.string().optional(), // comma-separated
  isOrgMember: z.string().optional(),
  orgMemberType: z.string().optional(),
  iataNumber: optionalText(20, { pattern: /^[A-Za-z0-9-]{4,20}$/, message: "Use 4 to 20 letters or digits." }),
});

export const step3HotelSchema = z.object({
  propertyType: z.string().min(1, "Select a property type."),
  propertyName: businessNameSchema,
  starRating: z.string().min(1, "Select a star rating."),
  propertyStreet: optionalText(200, { pattern: PLACE_CHARS, message: "Enter a valid street address." }),
  location: citySchema,
  totalRooms: wholeNumber(1, 5000, "Enter the total number of rooms.", "Enter a number from 1 to 5,000."),
  roomTypesJson: z.string().optional(),
  checkInTime: z.string().min(1, "Set a check-in time."),
  checkOutTime: z.string().min(1, "Set a check-out time."),
  amenities: z.string().optional(), // comma-separated
  cancellationPolicy: z.string().min(1, "Select a cancellation policy."),
});

export const step3AffiliateSchema = z.object({
  handlesJson: z.string().optional(),
  audienceSize: optionalWholeNumber(0, 1_000_000_000, "Enter a whole number."),
  trafficSource: z.string().min(1, "Select your primary traffic source."),
  promotionPlan: z
    .string()
    .trim()
    .min(10, "Describe how you will promote STS Somalia.")
    .max(1000, "Use 1,000 characters or fewer."),
});

// Venue application captures the flagship hall's shape — actual venue
// listings (with photos, live pricing) are created in the Venue Portal after
// approval, same split as hotel_partner's property step vs the portal.
export const step3VenueSchema = z.object({
  venueName: businessNameSchema,
  location: citySchema,
  seatedCapacity: optionalWholeNumber(1, 100_000, "Enter a number from 1 to 100,000."),
  standingCapacity: wholeNumber(1, 100_000, "Enter the standing capacity.", "Enter a number from 1 to 100,000."),
  eventTypes: z.string().optional(), // comma-separated
  indicativePrice: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 10_000_000), "Enter a valid amount.")
    .optional(),
});

export const step4AgencySchema = z.object({
  paymentModel: z.enum(["prepaid_wallet", "credit_line"], "Select a payment model."),
  requestedMarkupPreset: z.string().optional(),
  requestedMarkupCustom: z.string().optional(),
  estimatedMonthlyVolume: optionalText(40),
  bankName: bankName(false),
  bankAccountName: accountName(false),
  bankAccountNumber: accountNumber(false),
  remarks: optionalText(1000),
});

// A hotel is a supplier, not a buyer: it never taps a wallet/credit line, it
// gets PAID OUT for completed stays, so bank details are mandatory here
// (they're optional for an agency, whose primary settlement method is the
// wallet/credit line above) and the only choice to make is payout cadence.
export const step4HotelSchema = z.object({
  payoutFrequency: z.string().min(1, "Select a payout frequency."),
  bankName: bankName(true),
  bankAccountName: accountName(true),
  bankAccountNumber: accountNumber(true),
});

export type FieldErrors = Record<string, string>;

/** First message per field, keyed by form field name. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Upload limits, shared by the server actions that enforce them and the file
 * inputs that must pre-check against them. The pre-check is not a nicety:
 * Next rejects a Server Action request whose body exceeds
 * serverActions.bodySizeLimit (6mb, next.config.ts) before the action runs at
 * all, so an oversized file never reaches the server-side size check and
 * surfaces as an unhandled 500 instead of a readable message. Keep this
 * comfortably under that limit.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf"];
export const UPLOAD_SIZE_ERROR = "File must be 5MB or smaller.";
export const UPLOAD_TYPE_ERROR = "Only PDF files are accepted.";

/** Shared by every client-side file input that posts to a Server Action. */
export function checkUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return UPLOAD_TYPE_ERROR;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_SIZE_ERROR;
  return null;
}

/** A logo is a branding image, not a compliance document — its own (looser, image-only) limits. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const LOGO_SIZE_ERROR = "Logo must be 2MB or smaller.";
export const LOGO_TYPE_ERROR = "Only PNG, JPG, WebP, or SVG images are accepted.";

export function checkLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) return LOGO_TYPE_ERROR;
  if (file.size > MAX_LOGO_BYTES) return LOGO_SIZE_ERROR;
  return null;
}
