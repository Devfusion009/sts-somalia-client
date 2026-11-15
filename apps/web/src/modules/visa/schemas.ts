import { z } from "zod";
import { RELATIONSHIPS } from "@sts/shared-types";
import { COUNTRY_NAMES } from "@/lib/countries";

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

/** Today as YYYY-MM-DD (UTC) — date inputs submit this format, so plain string order is date order. */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const isoDate = (message: string) => z.string({ error: message }).regex(/^\d{4}-\d{2}-\d{2}$/, message).refine(value => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, message);
const pastDate = (message: string) =>
  isoDate(message).refine((d) => d < todayIso(), "Date of birth must be in the past.");
const unexpiredDate = (message: string) =>
  isoDate(message).refine((d) => d > todayIso(), "This passport has expired.");

/**
 * Only what the passport, the consulate contact chain, and payment actually
 * need. Anything a specific destination additionally requires goes through
 * visa_types.application_sections (per-country, admin-configured) instead
 * of being asked of every applicant regardless of destination.
 */
export const personalInfoSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name as shown in the passport."),
  dateOfBirth: pastDate("Enter the date of birth."),
  gender: z.enum(["male", "female"], { error: "Select a gender." }),
  nationality: z.string().length(2, "Select a nationality."),
  passportNumber: z.string().trim().min(3, "Enter the passport number."),
  passportExpiry: unexpiredDate("Enter the passport expiry date."),
  email: z.string().trim().email("Enter a valid email address."),
  mobile: z.string().trim().regex(
    /^\+[1-9][0-9]{0,3} ?[0-9]{6,14}$/,
    "Enter a valid mobile number using digits only.",
  ).refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }, "Mobile number must contain 8–15 digits including the country code."),
});
export type PersonalInfo = z.infer<typeof personalInfoSchema>;

export const travelInfoSchema = z.object({
  arrivalDate: isoDate("Enter the arrival date.").refine((d) => d >= todayIso(), "Arrival date can't be in the past."),
  departureDate: isoDate("Enter the departure date."),
  purposeOfVisit: z.enum(
    ["tourism", "business", "family_visit", "medical", "transit", "umrah", "other"],
    { error: "Select the purpose of visit." }
  ),
  addressAtDestination: z.string().trim().min(3, "Enter a hotel name or contact address."),
}).refine((t) => t.departureDate >= t.arrivalDate, {
  message: "Departure must be on or after arrival.",
  path: ["departureDate"],
});
export type TravelInfo = z.infer<typeof travelInfoSchema>;

export const memberSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the member's full name."),
  relationship: z.enum(RELATIONSHIPS, { error: "Select a relationship." }),
  dateOfBirth: pastDate("Enter the date of birth."),
  nationality: z.string().length(2, "Select a nationality."),
  passportNumber: z.string().trim().min(3, "Enter the passport number."),
  passportExpiry: unexpiredDate("Enter a valid passport expiry date."),
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

type TravellerDocumentApplication = Parameters<typeof applicationDocumentSlots>[0] & {
  traveller_requirements?: unknown;
  workflow?: unknown;
  members: { id: string; full_name: string; is_primary?: boolean }[];
  documents?: { document_type: string; member_id: string | null; is_current?: boolean; review_status?: string }[];
};

/** Standard requirements repeat for every traveller, including the primary applicant. */
export function travellerDocumentSlots(app: TravellerDocumentApplication) {
  return app.members.length ? app.members.flatMap(member => {
    const quote = travellerRequirement(app, member.id);
    return parseDocumentSlots(quote?.required_documents ?? app.resolved_documents ?? app.visa_type?.required_documents)
      .map(slot => ({ ...slot, memberId: member.id as string | null, memberName: member.full_name as string | null }));
  }) : applicationDocumentSlots(app).map(slot => ({ ...slot, memberId: null as string | null, memberName: null as string | null }));
}

export function travellerRequirement(app: { traveller_requirements?: unknown; workflow?: unknown }, memberId: string): Record<string, unknown> | null {
  const workflow = app.workflow && typeof app.workflow === "object" ? app.workflow as Record<string, unknown> : {};
  const quotes = app.traveller_requirements ?? workflow.traveller_requirements;
  const quote = quotes && typeof quotes === "object" ? (quotes as Record<string, unknown>)[memberId] : null;
  return quote && typeof quote === "object" ? quote as Record<string, unknown> : null;
}

export function travellerPricing(app: { members: { id: string }[]; traveller_requirements?: unknown; workflow?: unknown; resolved_price?: number | null; resolved_processing_fee?: number | null; price?: number; visa_type?: { price?: number; processing_fee?: number | null } | null }) {
  const people = app.members.length ? app.members : [{ id: "" }];
  return people.reduce((total, member) => {
    const quote = travellerRequirement(app, member.id);
    return { price: total.price + Number(quote?.price ?? app.resolved_price ?? app.visa_type?.price ?? app.price ?? 0), fee: total.fee + Number(quote?.processing_fee ?? app.resolved_processing_fee ?? app.visa_type?.processing_fee ?? 0) };
  }, { price: 0, fee: 0 });
}

/** Historical unassigned standard files belong only to the primary traveller. */
export function documentMemberId(app: TravellerDocumentApplication, doc: { document_type: string; member_id: string | null }) {
  if (doc.member_id || !applicationDocumentSlots(app).some(slot => slot.key === doc.document_type)) return doc.member_id;
  return app.members.find(member => member.is_primary)?.id ?? app.members[0]?.id ?? null;
}

export function missingTravellerDocuments(app: TravellerDocumentApplication) {
  return travellerDocumentSlots(app).filter(slot => slot.required && !(app.documents ?? []).some(doc =>
    doc.document_type === slot.key && documentMemberId(app, doc) === slot.memberId && doc.is_current !== false && doc.review_status !== "rejected"
  ));
}

/* ------------------------------------------------------------------------- */
/* Admin-defined requirement sections (visa_types.application_sections)       */
/* ------------------------------------------------------------------------- */

export const REQUIREMENT_FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "date",
  "country",
  "phone",
  "email",
  "yes_no",
  "dropdown",
  "multi_choice",
  "file",
] as const;
export type RequirementFieldType = (typeof REQUIREMENT_FIELD_TYPES)[number];

export const REQUIREMENT_FIELD_TYPE_LABELS: Record<RequirementFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  country: "Country",
  phone: "Phone",
  email: "Email",
  yes_no: "Yes / No",
  dropdown: "Dropdown",
  multi_choice: "Multiple choice",
  file: "File upload",
};

/** Field types whose answer must be one of the admin's options. */
export const CHOICE_FIELD_TYPES: readonly RequirementFieldType[] = ["dropdown", "multi_choice"];

export type RequirementField = {
  key: string;
  label: string;
  type: RequirementFieldType;
  required: boolean;
  options?: string[];
};

export type RequirementScope = "application" | "traveller";

export type RequirementSection = {
  key: string;
  title: string;
  scope: RequirementScope;
  fields: RequirementField[];
};

/** A section's answers: one value per field key; multi-choice is a list. */
export type SectionAnswers = Record<string, string | string[]>;
/** All answers for one owner (the application or one traveller), by section key. */
export type RequirementAnswers = Record<string, SectionAnswers>;

const KEY_PATTERN = /^[a-z0-9_]+$/;

export function parseRequirementSections(raw: unknown): RequirementSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): RequirementSection[] => {
    if (!entry || typeof entry !== "object") return [];
    const s = entry as Record<string, unknown>;
    const key = typeof s.key === "string" ? s.key : "";
    if (!KEY_PATTERN.test(key)) return [];
    const fields = (Array.isArray(s.fields) ? s.fields : []).flatMap((f): RequirementField[] => {
      if (!f || typeof f !== "object") return [];
      const field = f as Record<string, unknown>;
      const fieldKey = typeof field.key === "string" ? field.key : "";
      const type = REQUIREMENT_FIELD_TYPES.find((t) => t === field.type);
      if (!KEY_PATTERN.test(fieldKey) || !type) return [];
      const options = Array.isArray(field.options) ? field.options.map(String).filter(Boolean) : undefined;
      if (CHOICE_FIELD_TYPES.includes(type) && !options?.length) return [];
      return [
        {
          key: fieldKey,
          label: typeof field.label === "string" && field.label.trim() ? field.label : fieldKey.replace(/_/g, " "),
          type,
          required: field.required !== false,
          ...(CHOICE_FIELD_TYPES.includes(type) ? { options } : {}),
        },
      ];
    });
    if (fields.length === 0) return [];
    return [
      {
        key,
        title: typeof s.title === "string" && s.title.trim() ? s.title : key.replace(/_/g, " "),
        scope: s.scope === "traveller" ? "traveller" : "application",
        fields,
      },
    ];
  });
}

/** Reads a jsonb answers blob ({ section: { field: value } }), dropping anything malformed. */
export function parseRequirementAnswers(raw: unknown): RequirementAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RequirementAnswers = {};
  for (const [section, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;
    const answers: SectionAnswers = {};
    for (const [field, value] of Object.entries(values as Record<string, unknown>)) {
      if (typeof value === "string") answers[field] = value;
      else if (Array.isArray(value)) answers[field] = value.map(String);
    }
    out[section] = answers;
  }
  return out;
}

/** Traveller-scope answers live in visa_members.details.answers. */
export function memberRequirementAnswers(details: unknown): RequirementAnswers {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return parseRequirementAnswers((details as Record<string, unknown>).answers);
}

/** visa_documents.document_type for a section file field. */
export function sectionFileKey(sectionKey: string, fieldKey: string) {
  return `${sectionKey}.${fieldKey}`;
}

/** Form input name for a non-file field; memberId only for traveller scope. */
export function sectionInputName(sectionKey: string, fieldKey: string, memberId?: string) {
  return memberId ? `s.${sectionKey}.${memberId}.${fieldKey}` : `s.${sectionKey}.${fieldKey}`;
}

/** Human-readable answer for review screens. */
export function formatRequirementAnswer(field: RequirementField, value: string | string[] | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "yes_no") return value === "yes" ? "Yes" : value === "no" ? "No" : value;
  if (field.type === "country") return COUNTRY_NAMES[value.toUpperCase()] ?? value;
  return value;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isEmpty(value: string | string[] | undefined) {
  return value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === "");
}

/**
 * Checks one owner's answers for a section. Returns the first problem as a
 * short message, or null. File fields are checked against uploads separately.
 */
export function sectionAnswerError(
  section: RequirementSection,
  answers: SectionAnswers | undefined,
  owner?: string
): string | null {
  const suffix = owner ? ` (${owner})` : "";
  for (const field of section.fields) {
    if (field.type === "file") continue;
    const value = answers?.[field.key];
    if (isEmpty(value)) {
      if (field.required) return `${section.title}: ${field.label} is required${suffix}.`;
      continue;
    }
    const text = Array.isArray(value) ? "" : (value ?? "").trim();
    const invalid = `${section.title}: ${field.label} is not valid${suffix}.`;
    switch (field.type) {
      case "email":
        if (!EMAIL_PATTERN.test(text)) return invalid;
        break;
      case "number":
        if (!Number.isFinite(Number(text))) return invalid;
        break;
      case "date":
        if (!DATE_PATTERN.test(text)) return invalid;
        break;
      case "country":
        if (!COUNTRY_NAMES[text.toUpperCase()]) return invalid;
        break;
      case "phone":
        if (!/^\+?[0-9 ()-]{6,20}$/.test(text)) return invalid;
        break;
      case "yes_no":
        if (text !== "yes" && text !== "no") return invalid;
        break;
      case "dropdown":
        if (!field.options?.includes(text)) return invalid;
        break;
      case "multi_choice": {
        const list = Array.isArray(value) ? value : [text];
        if (list.some((v) => !field.options?.includes(v))) return invalid;
        break;
      }
      default:
        if (text.length > 2000) return invalid;
    }
  }
  return null;
}

/** One upload a section file field asks for: per application, or per traveller. */
export type SectionFileSlot = {
  documentType: string;
  sectionTitle: string;
  label: string;
  required: boolean;
  memberId: string | null;
  memberName: string | null;
};

export function sectionFileSlots(
  sections: RequirementSection[],
  members: { id: string; full_name: string }[]
): SectionFileSlot[] {
  return sections.flatMap((section) =>
    section.fields
      .filter((f) => f.type === "file")
      .flatMap((field): SectionFileSlot[] => {
        const base = {
          documentType: sectionFileKey(section.key, field.key),
          sectionTitle: section.title,
          label: field.label,
          required: field.required,
        };
        return section.scope === "traveller"
          ? members.map((m) => ({ ...base, memberId: m.id, memberName: m.full_name }))
          : [{ ...base, memberId: null, memberName: null }];
      })
  );
}

/** Label for a stored document_type that belongs to a section file field, or null. */
export function sectionFileLabel(sections: RequirementSection[], documentType: string): string | null {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === "file" && sectionFileKey(section.key, field.key) === documentType) {
        return `${section.title}: ${field.label}`;
      }
    }
  }
  return null;
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
