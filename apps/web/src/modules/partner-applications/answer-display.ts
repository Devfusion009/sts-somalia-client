export const NOT_PROVIDED_BY_APPLICANT = "Not provided by applicant";

export function applicantAnswer(value: unknown): string {
  return value === null || value === undefined || (typeof value === "string" && !value.trim())
    ? NOT_PROVIDED_BY_APPLICANT : String(value);
}
