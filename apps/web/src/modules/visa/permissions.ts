import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Visa staff permission registry. Mirrors public.visa_staff_can() in
 * supabase/migrations/20260928000001_visa_rbac_and_rls_fixes.sql — both
 * currently grant every key to platform admins. Staff roles plug in by
 * changing visaStaffCan() and the SQL helper only; every call site already
 * asks for a specific key.
 */
export const VISA_PERMISSIONS = {
  "visa.applications.read": "View applications",
  "visa.applications.edit": "Edit applications",
  "visa.assign": "Assign cases",
  "visa.documents.review": "Review documents",
  "visa.documents.request": "Request documents",
  "visa.payment.confirm": "Confirm payments",
  "visa.appointments.manage": "Manage appointments",
  "visa.submission.record": "Record submissions",
  "visa.processing.update": "Record processing updates",
  "visa.decision.record": "Record decisions",
  "visa.decision.correct": "Correct decisions",
  "visa.passport.manage": "Manage passports",
  "visa.messages.send": "Message applicants",
  "visa.notes.read": "Read internal notes",
  "visa.notes.write": "Write internal notes",
  "visa.case.cancel": "Cancel cases",
  "visa.config.manage": "Configure visa catalog",
  "visa.audit.read": "Read audit trail",
} as const;

export type VisaPermission = keyof typeof VISA_PERMISSIONS;

export const VISA_ROLES = {
  super_admin: "Super Admin",
  ops_manager: "Visa Operations Manager",
  document_officer: "Document Officer",
  appointment_officer: "Appointment Officer",
  finance_officer: "Finance Officer",
  customer_support: "Customer Support",
  auditor: "Auditor",
} as const;

export type VisaRole = keyof typeof VISA_ROLES;

const ALL = Object.keys(VISA_PERMISSIONS) as VisaPermission[];

/** Default grants per role (spec §31). Not enforced yet — see visaStaffCan(). */
export const VISA_ROLE_GRANTS: Record<VisaRole, VisaPermission[]> = {
  super_admin: ALL,
  ops_manager: ALL.filter((p) => p !== "visa.payment.confirm" && p !== "visa.config.manage"),
  document_officer: [
    "visa.applications.read",
    "visa.documents.review",
    "visa.documents.request",
    "visa.notes.read",
    "visa.notes.write",
  ],
  appointment_officer: [
    "visa.applications.read",
    "visa.appointments.manage",
    "visa.notes.read",
    "visa.notes.write",
  ],
  finance_officer: ["visa.applications.read", "visa.payment.confirm", "visa.audit.read"],
  customer_support: [
    "visa.applications.read",
    "visa.documents.request",
    "visa.messages.send",
    "visa.notes.read",
  ],
  auditor: ["visa.applications.read", "visa.notes.read", "visa.audit.read"],
};

export function visaStaffCan(profile: Pick<Profile, "is_platform_admin"> | null, perm: VisaPermission): boolean {
  return Boolean(profile?.is_platform_admin) && perm in VISA_PERMISSIONS;
}
