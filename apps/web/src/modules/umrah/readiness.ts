/** Labels for umrah_pilgrim_readiness's missing / warnings codes. */
export const READINESS_LABEL: Record<string, string> = {
  passport_number: "Passport missing",
  passport_expiry: "Passport expiry missing",
  passport_expires_too_soon: "Passport expires too soon",
  date_of_birth: "Date of birth missing",
  nationality: "Nationality missing",
  "document:passport_copy": "Passport copy missing",
  "document:photo": "Photo missing",
  "document:vaccination": "Vaccination missing",
  "document:national_id": "National ID missing",
  mahram_missing: "Mahram missing",
};

export type PilgrimReadiness = { missing: string[]; warnings: string[] };

export function readinessLabel(code: string) {
  return READINESS_LABEL[code] ?? code.replace(/_/g, " ");
}

/** Customer hand-in document types and labels. */
export const HAND_IN_TYPES = ["passport_copy", "photo", "vaccination", "national_id"] as const;
export type HandInType = (typeof HAND_IN_TYPES)[number];

export const HAND_IN_LABEL: Record<HandInType, string> = {
  passport_copy: "Passport copy",
  photo: "Photo",
  vaccination: "Vaccination certificate",
  national_id: "National ID",
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "In review",
  accepted: "Accepted",
  rejected: "Rejected",
};
