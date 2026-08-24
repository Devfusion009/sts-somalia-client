/**
 * Re-export, not a definition. Moved to packages/shared-types (phase 4b)
 * so apps/api's travelers module could validate against the same schema.
 * Kept under this path so existing component imports need no changes.
 */
export {
  RELATIONSHIPS,
  TRAVELER_DOCUMENT_TYPES,
  PASSPORT_VALIDITY_MONTHS,
  travelerSchema,
  passportStatus,
  type TravelerDocumentType,
  type TravelerInput,
  type PassportStatus,
} from "@sts/shared-types";
