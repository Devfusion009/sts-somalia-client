import { z } from "zod";

/**
 * Wizard step payloads. traveler_details / contact_details / travel_details
 * are stored as snake_case jsonb on visa_applications; these schemas are the
 * single source of truth for what those blobs contain.
 */

export const APPLICANT_TYPES = ["single", "family", "group"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const RELATIONSHIPS = [
  "self",
  "spouse",
  "son",
  "daughter",
  "father",
  "mother",
  "brother",
  "sister",
  "grandfather",
  "grandmother",
  "other",
] as const;

export const personalInfoSchema = z.object({
  fullName: z.string().min(2, "Enter the full name as shown in the passport."),
  dateOfBirth: z.string().min(1, "Enter the date of birth."),
  gender: z.enum(["male", "female"], { error: "Select a gender." }),
  nationality: z.string().length(2, "Select a nationality."),
  passportNumber: z.string().min(3, "Enter the passport number."),
  passportExpiry: z.string().min(1, "Enter the passport expiry date."),
  placeOfBirth: z.string().min(1, "Enter the place of birth."),
  countryOfBirth: z.string().length(2, "Select the country of birth."),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"], {
    error: "Select a marital status.",
  }),
  email: z.string().email("Enter a valid email address."),
  mobile: z.string().min(7, "Enter a valid mobile number."),
  occupation: z.string().min(2, "Enter an occupation."),
});
export type PersonalInfo = z.infer<typeof personalInfoSchema>;

export const travelInfoSchema = z.object({
  arrivalDate: z.string().min(1, "Enter the arrival date."),
  departureDate: z.string().min(1, "Enter the departure date."),
  portOfEntry: z.string().min(2, "Enter the port of entry."),
  portOfExit: z.string().optional(),
  flightNumber: z.string().optional(),
  returnFlightNumber: z.string().optional(),
  purposeOfVisit: z.enum(
    ["tourism", "business", "family_visit", "medical", "transit", "umrah", "other"],
    { error: "Select the purpose of visit." }
  ),
  payer: z.enum(["self", "sponsor", "company", "relative"], {
    error: "Select who will pay for the trip.",
  }),
  sponsorName: z.string().optional(),
  addressAtDestination: z.string().min(3, "Enter a hotel name or contact address."),
  hasRelatives: z.enum(["yes", "no"]),
  visitedBefore: z.enum(["yes", "no"]),
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
  processing: "Under Processing",
  approved: "Approved",
  rejected: "Rejected",
  issued: "Visa Issued",
  cancelled: "Cancelled",
};
