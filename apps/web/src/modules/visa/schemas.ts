import { z } from "zod";
import { RELATIONSHIPS } from "@sts/shared-types";

/**
 * Wizard step payloads. traveler_details / contact_details / travel_details
 * are stored as snake_case jsonb on visa_applications; these schemas are the
 * single source of truth for what those blobs contain.
 */

export const APPLICANT_TYPES = ["single", "family", "group"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

/**
 * Re-exported, not defined here — moved to packages/shared-types (phase
 * 4b) since modules/travelers/schemas.ts needs this same vocabulary (a
 * saved traveler prefills a visa member row, so the two lists must stay
 * identical). This file keeps re-exporting it under its original name so
 * visa's still-unmigrated code (phase 6) needs zero changes.
 */
export { RELATIONSHIPS };

/**
 * Only what the passport, the consulate contact chain, and payment actually
 * need. Anything a specific destination additionally requires goes through
 * visa_types.application_questions (per-country, admin-configured) instead
 * of being asked of every applicant regardless of destination.
 */
export const personalInfoSchema = z.object({
  fullName: z.string().min(2, "Enter the full name as shown in the passport."),
  dateOfBirth: z.string().min(1, "Enter the date of birth."),
  gender: z.enum(["male", "female"], { error: "Select a gender." }),
  nationality: z.string().length(2, "Select a nationality."),
  passportNumber: z.string().min(3, "Enter the passport number."),
  passportExpiry: z.string().min(1, "Enter the passport expiry date."),
  email: z.string().email("Enter a valid email address."),
  mobile: z.string().min(7, "Enter a valid mobile number."),
});
export type PersonalInfo = z.infer<typeof personalInfoSchema>;

export const travelInfoSchema = z.object({
  arrivalDate: z.string().min(1, "Enter the arrival date."),
  departureDate: z.string().min(1, "Enter the departure date."),
  purposeOfVisit: z.enum(
    ["tourism", "business", "family_visit", "medical", "transit", "umrah", "other"],
    { error: "Select the purpose of visit." }
  ),
  addressAtDestination: z.string().min(3, "Enter a hotel name or contact address."),
});
export type TravelInfo = z.infer<typeof travelInfoSchema>;

export const memberSchema = z.object({
  fullName: z.string().min(2, "Enter the member's full name."),
  relationship: z.enum(RELATIONSHIPS, { error: "Select a relationship." }),
  dateOfBirth: z.string().min(1, "Enter the date of birth."),
  nationality: z.string().length(2, "Select a nationality."),
  passportNumber: z.string().min(3, "Enter the passport number."),
  passportExpiry: z.string().optional(),
});
export type MemberInput = z.infer<typeof memberSchema>;

/** One upload slot from visa_types.required_documents. */
export type DocumentSlot = {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  max_mb?: number;
};

export function parseDocumentSlots(raw: unknown): DocumentSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): DocumentSlot[] => {
    if (typeof entry === "string") {
      // Legacy shape: bare keys like "passport_scan".
      return [{ key: entry, label: entry.replace(/_/g, " "), required: true }];
    }
    if (entry && typeof entry === "object" && "key" in entry && "label" in entry) {
      const slot = entry as Record<string, unknown>;
      return [
        {
          key: String(slot.key),
          label: String(slot.label),
          description: slot.description ? String(slot.description) : undefined,
          required: slot.required !== false,
          max_mb: typeof slot.max_mb === "number" ? slot.max_mb : undefined,
        },
      ];
    }
    return [];
  });
}

/**
 * The slots this application must fill: the nationality-resolved list when
 * one was stamped, otherwise the visa type's default. Matches
 * _visa_required_slots() in SQL.
 */
export function applicationDocumentSlots(app: {
  resolved_documents?: unknown;
  visa_type?: { required_documents?: unknown } | null;
}): DocumentSlot[] {
  return parseDocumentSlots(app.resolved_documents ?? app.visa_type?.required_documents);
}

/** One country-specific extra question from visa_types.application_questions. */
export type ApplicationQuestion = {
  key: string;
  label: string;
  type: "text" | "yesno" | "select";
  options?: string[];
  required: boolean;
};

export function parseApplicationQuestions(raw: unknown): ApplicationQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): ApplicationQuestion[] => {
    if (!entry || typeof entry !== "object" || !("key" in entry) || !("label" in entry)) return [];
    const q = entry as Record<string, unknown>;
    const type = q.type === "yesno" || q.type === "select" ? q.type : "text";
    return [
      {
        key: String(q.key),
        label: String(q.label),
        type,
        options: Array.isArray(q.options) ? q.options.map(String) : undefined,
        required: q.required !== false,
      },
    ];
  });
}

/** Customer-facing labels for application statuses (badges, timeline). */
export const VISA_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "Under Review",
  additional_info_required: "Additional Documents",
  ready_for_processing: "Ready for Processing",
  processing: "Under Processing",
  approved: "Approved",
  rejected: "Rejected",
  issued: "Visa Issued",
  cancelled: "Cancelled",
};
