"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import {
  assertAgencyCanBookProduct,
  createOrderForBooking,
  getActiveAgencyId,
  deskOrderPath,
} from "@/modules/orders/helpers";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { travellerName } from "@/modules/agencies/traveller-profile";
import {
  APPLICANT_TYPES,
  applicationDocumentSlots,
  memberSchema,
  memberRequirementAnswers,
  parseRequirementAnswers,
  parseRequirementSections,
  personalInfoSchema,
  sectionAnswerError,
  sectionFileSlots,
  sectionInputName,
  travelInfoSchema,
  type RequirementAnswers,
  type RequirementSection,
  type SectionAnswers,
} from "./schemas";

/** Wording version of the authorisation and refund policy on the review step. */
const VISA_CONSENT_VERSION = "2026-11-14";

export type ActionState = {
  error: string | null;
  /** Submitted field values echoed back so forms can re-fill after a
   *  validation error (React 19 resets uncontrolled fields post-action). */
  values?: Record<string, string>;
  /** Next step on the current host, consumed by the wizard forms. */
  destination?: string;
} | null;

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "applicationId") out[key] = value;
  }
  return out;
}

/** formValues plus multi-choice lists, which formValues would cut to their last entry. */
function travelFormValues(
  formData: FormData,
  sections: RequirementSection[],
  members: { id: string }[]
): Record<string, string> {
  const values = formValues(formData);
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type !== "multi_choice") continue;
      const names = section.scope === "traveller"
        ? members.map((m) => sectionInputName(section.key, field.key, m.id))
        : [sectionInputName(section.key, field.key)];
      for (const name of names) values[name] = JSON.stringify(formData.getAll(name).map(String));
    }
  }
  return values;
}

const MAX_UPLOAD_BYTES_DEFAULT = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/** RLS-scoped fetch that also proves "mine + still editable". */
async function getEditableApplication(applicationId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select("*, visa_type:visa_type_id (*), members:visa_members (*), documents:visa_documents (*)")
    .eq("id", applicationId)
    .eq("submitted_by", userId)
    .eq("status", "draft")
    .maybeSingle();
  return { supabase, application: data };
}

type EditableApplication = NonNullable<Awaited<ReturnType<typeof getEditableApplication>>["application"]>;

function orderedMembers<T extends { is_primary: boolean; sort_order: number }>(members: T[]): T[] {
  return [...members].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
}

/** First problem with the admin-defined section answers, or null. */
function requirementAnswersError(
  sections: RequirementSection[],
  appAnswers: RequirementAnswers,
  members: { id: string; full_name: string; details: unknown }[]
): string | null {
  for (const section of sections) {
    if (section.scope === "application") {
      const error = sectionAnswerError(section, appAnswers[section.key]);
      if (error) return error;
      continue;
    }
    for (const member of members) {
      const error = sectionAnswerError(section, memberRequirementAnswers(member.details)[section.key], member.full_name);
      if (error) return error;
    }
  }
  return null;
}

/** Required section file uploads still missing, as display labels. */
function missingSectionFiles(application: EditableApplication, sections: RequirementSection[]): string[] {
  const members = orderedMembers(application.members);
  return sectionFileSlots(sections, members)
    .filter((slot) => slot.required)
    .filter(
      (slot) =>
        !application.documents.some(
          (d) => d.document_type === slot.documentType && (slot.memberId === null || d.member_id === slot.memberId)
        )
    )
    .map((slot) => (slot.memberName ? `${slot.label} (${slot.memberName})` : slot.label));
}

/**
 * The upload target a slotKey (+ optional member) names: a visa type document
 * slot, or a file field of an admin-defined section. Null when it is neither.
 */
function resolveUploadSlot(application: EditableApplication, slotKey: string, memberId: string | null) {
  const slot = applicationDocumentSlots(application).find((s) => s.key === slotKey);
  if (slot) return { key: slot.key, label: slot.label, maxMb: slot.max_mb ?? 5, memberId: null, sectionField: false };
  const sections = parseRequirementSections(application.visa_type?.application_sections);
  const fileSlot = sectionFileSlots(sections, application.members).find(
    (s) => s.documentType === slotKey && s.memberId === memberId
  );
  if (!fileSlot) return null;
  return { key: fileSlot.documentType, label: fileSlot.label, maxMb: 5, memberId: fileSlot.memberId, sectionField: true };
}

/** Earlier uploads the new file replaces: same slot, and same traveller for section files. */
function previousUploads(application: EditableApplication, target: NonNullable<ReturnType<typeof resolveUploadSlot>>) {
  return application.documents.filter(
    (doc) => doc.document_type === target.key && (!target.sectionField || doc.member_id === target.memberId)
  );
}

function wizardPath(applicationId: string, step: number) {
  return `/visa/apply/${applicationId}?step=${step}`;
}

function deskWizardPath(applicationId: string, step: number) {
  return `/agent/book/visa/apply/${applicationId}?step=${step}`;
}

/**
 * Ends a wizard step. Sessions on the agent portal (host-only auth cookies —
 * see lib/subdomain.ts's cookieDomain) can't follow a Server Action redirect()
 * to a path meant for the public site's host: the same trap deskOrderPath
 * documents for hotel bookings. A desk submission gets its destination back
 * as state and navigates client-side instead (window.location.href, which
 * always resolves against the actual current origin). Public submissions use
 * the same handoff: a saved step must not leave useActionState pending while
 * the App Router tries to resolve a Server Action redirect.
 */
function advanceWizard(formData: FormData, applicationId: string, step: number): ActionState {
  const destination = formData.get("desk") === "1"
    ? deskWizardPath(applicationId, step)
    : wizardPath(applicationId, step);
  return { error: null, destination };
}

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------
export async function startVisaApplication(formData: FormData): Promise<void> {
  const visaTypeId = z.string().uuid().parse(formData.get("visaTypeId"));
  const user = await getCurrentProfile();
  // Send signed-out visitors through login and straight back to this visa.
  if (!user) redirect(`/login?redirect_to=${encodeURIComponent(`/visa/${visaTypeId}`)}`);
  const supabase = await createClient();

  const { data: existingDraft } = await supabase
    .from("visa_applications")
    .select("id")
    .eq("visa_type_id", visaTypeId)
    .eq("submitted_by", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDraft) redirect(wizardPath(existingDraft.id, 1));

  const { data: visaType } = await supabase
    .from("visa_types")
    .select("*")
    .eq("id", visaTypeId)
    .eq("status", "published")
    .maybeSingle();
  if (!visaType) redirect("/visa");

  // A nationality chosen on the detail page seeds the field; the quote for it
  // (price, fee, documents) is stamped by visa_applications_draft_integrity.
  const chosen = formData.get("nationality")?.toString().trim().toUpperCase();
  const nationality = chosen && chosen !== visaType.destination_country_code.toUpperCase() ? chosen : undefined;

  const { data: application, error } = await supabase
    .from("visa_applications")
    .insert({
      visa_type_id: visaType.id,
      applicant_profile_id: user.id,
      submitted_by: user.id,
      status: "draft",
      price: visaType.price,
      currency: visaType.currency,
      contact_details: { email: user.email ?? "", mobile: user.phone ?? "" },
      ...(nationality ? { traveler_details: { nationality } } : {}),
    })
    .select("id")
    .single();

  if (error || !application) redirect("/visa");
  redirect(wizardPath(application.id, 1));
}

/**
 * Desk equivalent of startVisaApplication — separate function rather than a
 * branch inside it, because that one is bound straight to a <form action>
 * (no useActionState) and always ends in redirect(); this one is read
 * through useActionState so the desk page can navigate to the destination
 * itself. Always for the agent's own agency, and always for the customer
 * already selected at /agent/book (agencyCustomerId), not a self-service
 * applicant_profile_id.
 */
export async function startDeskVisaApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ visaTypeId: z.string().uuid(), agencyCustomerId: z.string().uuid() })
    .safeParse({
      visaTypeId: formData.get("visaTypeId"),
      agencyCustomerId: formData.get("agencyCustomerId"),
    });
  if (!parsed.success) return { error: "Invalid request." };

  const user = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, user.id);
  if (!agencyId) return { error: "You are not an active member of an agency." };
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "visa");
  if (!access.ok) return { error: access.message };

  const { data: visaType } = await supabase
    .from("visa_types")
    .select("*")
    .eq("id", parsed.data.visaTypeId)
    .eq("status", "published")
    .maybeSingle();
  if (!visaType) return { error: "This visa product is no longer available." };

  // The wizard starts from the saved profiles: the primary applicant's
  // identity and contact, and one member row per other selected customer.
  const customers = await getBookingCustomers(supabase, agencyId);
  const primary = customers.find((customer) => customer.id === parsed.data.agencyCustomerId);
  if (!primary) return { error: "Choose the customer again." };
  const others = customers.filter((customer) => customer.id !== primary.id);
  const destination = visaType.destination_country_code.toUpperCase();
  const nationality = (code: string | null) =>
    code && code.toUpperCase() !== destination ? code.toUpperCase() : null;
  const filled = (values: Record<string, string | null>) =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value));

  const { data: application, error } = await supabase
    .from("visa_applications")
    .insert({
      visa_type_id: visaType.id,
      submitted_by: user.id,
      agency_id: agencyId,
      agency_customer_id: primary.id,
      status: "draft",
      price: visaType.price,
      currency: visaType.currency,
      applicant_type: others.length > 0 ? "group" : "single",
      traveler_details: filled({
        full_name: travellerName(primary),
        date_of_birth: primary.date_of_birth,
        gender: primary.gender,
        nationality: nationality(primary.nationality),
        passport_number: primary.passport_number,
        passport_expiry: primary.passport_expiry_date,
      }),
      contact_details: filled({ email: primary.email, mobile: primary.phone }),
    })
    .select("id")
    .single();
  if (error || !application) return { error: error?.message ?? "Could not start the application." };

  if (others.length > 0) {
    const { error: membersError } = await supabase.from("visa_members").insert(
      others.map((customer, index) => ({
        application_id: application.id,
        full_name: travellerName(customer),
        relationship: "other",
        date_of_birth: customer.date_of_birth,
        nationality: nationality(customer.nationality),
        passport_number: customer.passport_number,
        passport_expiry: customer.passport_expiry_date,
        sort_order: index,
      }))
    );
    if (membersError) return { error: membersError.message };
  }

  return { error: null, destination: deskWizardPath(application.id, 1) };
}

// ---------------------------------------------------------------------------
// Step 1 — applicant type (+ family/group members)
// ---------------------------------------------------------------------------
export async function saveApplicantType(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      applicantType: z.enum(APPLICANT_TYPES),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      applicantType: formData.get("applicantType"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(
    parsed.data.applicationId,
    user.id
  );
  if (!application) return { error: "This application can no longer be edited." };

  if (parsed.data.applicantType !== "single") {
    const others = application.members.filter((m) => !m.is_primary);
    if (others.length === 0) {
      return {
        error:
          parsed.data.applicantType === "family"
            ? "Add at least one family member (or choose Single Applicant)."
            : "Add at least one group member (or choose Single Applicant).",
      };
    }
  }

  await supabase
    .from("visa_applications")
    .update({
      applicant_type: parsed.data.applicantType,
      current_step: Math.max(application.current_step, 2),
    })
    .eq("id", application.id);

  // Members added while experimenting don't belong on a single application.
  if (parsed.data.applicantType === "single") {
    await supabase
      .from("visa_members")
      .delete()
      .eq("application_id", application.id)
      .eq("is_primary", false);
  }

  return advanceWizard(formData, application.id, 2);
}

/** A visa for a country a traveller already holds the passport of makes no sense. */
function isDestinationCountry(application: { visa_type: { destination_country_code: string } | null }, nationality: string) {
  return application.visa_type?.destination_country_code.toUpperCase() === nationality.toUpperCase();
}

export type MemberActionState =
  | { error: string; member?: undefined }
  | { error: null; member: Database["public"]["Tables"]["visa_members"]["Row"] }
  | null;

/**
 * Returns the saved row instead of revalidating the wizard: a revalidation
 * re-renders the whole page (header, footer, application query) before the
 * dialog can close. The table merges the row client-side.
 */
export async function saveVisaMember(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  const parsed = memberSchema.safeParse({
    fullName: formData.get("fullName"),
    relationship: formData.get("relationship"),
    dateOfBirth: formData.get("dateOfBirth"),
    nationality: formData.get("nationality"),
    passportNumber: formData.get("passportNumber"),
    passportExpiry: formData.get("passportExpiry")?.toString() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The application read only needs RLS, so it overlaps the auth check; the
  // ownership filter is applied once the user is known.
  const supabase = await createClient();
  const [user, { data: application }] = await Promise.all([
    requireUser(),
    supabase
      .from("visa_applications")
      .select("id, submitted_by, visa_type:visa_type_id (destination_country_code), members:visa_members (id)")
      .eq("id", applicationId.data)
      .eq("status", "draft")
      .maybeSingle(),
  ]);
  if (!application || application.submitted_by !== user.id) {
    return { error: "This application can no longer be edited." };
  }
  if (isDestinationCountry(application, parsed.data.nationality)) {
    return { error: "Passport nationality can't be the same as the destination country." };
  }

  const memberId = formData.get("memberId")?.toString();
  const row = {
    application_id: application.id,
    full_name: parsed.data.fullName,
    relationship: parsed.data.relationship,
    date_of_birth: parsed.data.dateOfBirth,
    nationality: parsed.data.nationality,
    passport_number: parsed.data.passportNumber,
    passport_expiry: parsed.data.passportExpiry || null,
  };

  const result = memberId
    ? await supabase
        .from("visa_members")
        .update(row)
        .eq("id", memberId)
        .eq("application_id", application.id)
        .select("*")
        .single()
    : await supabase
        .from("visa_members")
        .insert({ ...row, sort_order: application.members.length })
        .select("*")
        .single();
  if (result.error) return { error: result.error.message };
  return { error: null, member: result.data };
}

export async function removeVisaMember(formData: FormData): Promise<void> {
  const memberId = z.string().uuid().parse(formData.get("memberId"));
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));
  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId, user.id);
  if (!application) return;

  await supabase
    .from("visa_members")
    .delete()
    .eq("id", memberId)
    .eq("application_id", application.id)
    .eq("is_primary", false);
  revalidatePath(`/visa/apply/${application.id}`);
}

// ---------------------------------------------------------------------------
// Step 2 — personal information (primary applicant)
// ---------------------------------------------------------------------------
export async function savePersonalInfo(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  const parsed = personalInfoSchema.safeParse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    nationality: formData.get("nationality"),
    passportNumber: formData.get("passportNumber"),
    passportExpiry: formData.get("passportExpiry"),
    email: formData.get("email"),
    mobile: formData.get("mobile"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId.data, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const d = parsed.data;
  if (isDestinationCountry(application, d.nationality)) {
    return { error: "Passport nationality can't be the same as the destination country.", values: formValues(formData) };
  }

  // Saving nationality re-stamps the quote (price, fee, documents) server-side
  // in visa_applications_draft_integrity; nothing re-resolves after submit.
  const { error: saveError } = await supabase
    .from("visa_applications")
    .update({
      traveler_details: {
        full_name: d.fullName,
        date_of_birth: d.dateOfBirth,
        gender: d.gender,
        nationality: d.nationality,
        passport_number: d.passportNumber,
        passport_expiry: d.passportExpiry,
      },
      contact_details: { email: d.email, mobile: d.mobile },
      current_step: Math.max(application.current_step, 3),
    })
    .eq("id", application.id);
  if (saveError) return { error: saveError.message, values: formValues(formData) };

  // The primary applicant is also a member row so the member list is the
  // complete travelling party.
  const primary = application.members.find((m) => m.is_primary);
  const primaryRow = {
    application_id: application.id,
    is_primary: true,
    full_name: d.fullName,
    relationship: "self",
    date_of_birth: d.dateOfBirth,
    nationality: d.nationality,
    passport_number: d.passportNumber,
    passport_expiry: d.passportExpiry,
    sort_order: -1,
  };
  const primarySave = primary
    ? await supabase.from("visa_members").update(primaryRow).eq("id", primary.id)
    : await supabase.from("visa_members").insert(primaryRow);
  if (primarySave.error) return { error: primarySave.error.message, values: formValues(formData) };

  return advanceWizard(formData, application.id, 3);
}

// ---------------------------------------------------------------------------
// Step 3 — travel information
// ---------------------------------------------------------------------------
export async function saveTravelInfo(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  const parsed = travelInfoSchema.safeParse({
    arrivalDate: formData.get("arrivalDate"),
    departureDate: formData.get("departureDate"),
    purposeOfVisit: formData.get("purposeOfVisit"),
    addressAtDestination: formData.get("addressAtDestination"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId.data, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  // Admin-defined sections (visa_types.application_sections) render at the
  // end of this step and save in the same request. File fields upload on the
  // documents step instead.
  const sections = parseRequirementSections(application.visa_type?.application_sections);
  const members = orderedMembers(application.members);
  const readValue = (name: string, multi: boolean): string | string[] | undefined => {
    if (multi) {
      const list = formData.getAll(name).filter((v): v is string => typeof v === "string" && v !== "");
      return list.length ? list : undefined;
    }
    const value = formData.get(name);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const readSection = (section: RequirementSection, memberId?: string): SectionAnswers => {
    const answers: SectionAnswers = {};
    for (const field of section.fields) {
      if (field.type === "file") continue;
      const value = readValue(sectionInputName(section.key, field.key, memberId), field.type === "multi_choice");
      if (value !== undefined) answers[field.key] = field.type === "country" && typeof value === "string" ? value.toUpperCase() : value;
    }
    return answers;
  };
  const customAnswers: RequirementAnswers = {};
  const memberAnswers = new Map<string, RequirementAnswers>(members.map((m) => [m.id, {}]));
  for (const section of sections) {
    if (section.scope === "application") customAnswers[section.key] = readSection(section);
    else for (const m of members) memberAnswers.get(m.id)![section.key] = readSection(section, m.id);
  }
  const answersError = requirementAnswersError(
    sections,
    customAnswers,
    members.map((m) => ({ ...m, details: { answers: memberAnswers.get(m.id) } }))
  );
  if (answersError) return { error: answersError, values: travelFormValues(formData, sections, members) };

  const d = parsed.data;
  const passportExpiry = (application.traveler_details as Record<string, string> | null)?.passport_expiry;
  if (passportExpiry && passportExpiry <= d.departureDate) {
    return { error: "The passport expires before the departure date.", values: travelFormValues(formData, sections, members) };
  }
  const { error: travelSaveError } = await supabase
    .from("visa_applications")
    .update({
      travel_details: {
        arrival_date: d.arrivalDate,
        departure_date: d.departureDate,
        purpose: d.purposeOfVisit,
        address: d.addressAtDestination,
      },
      custom_answers: customAnswers,
    })
    .eq("id", application.id);
  if (travelSaveError) return { error: travelSaveError.message, values: travelFormValues(formData, sections, members) };

  if (sections.some((section) => section.scope === "traveller")) {
    const memberSaves = await Promise.all(
      members.map((m) => {
        const details = m.details && typeof m.details === "object" && !Array.isArray(m.details) ? m.details : {};
        return supabase
          .from("visa_members")
          .update({ details: { ...details, answers: memberAnswers.get(m.id) ?? {} } })
          .eq("id", m.id)
          .eq("application_id", application.id);
      })
    );
    const memberSaveError = memberSaves.find((result) => result.error)?.error;
    if (memberSaveError) return { error: memberSaveError.message, values: travelFormValues(formData, sections, members) };
  }

  const { error: progressError } = await supabase.from("visa_applications")
    .update({ current_step: Math.max(application.current_step, 4) }).eq("id", application.id);
  if (progressError) return { error: progressError.message, values: travelFormValues(formData, sections, members) };
  return advanceWizard(formData, application.id, 4);
}

// ---------------------------------------------------------------------------
// Step 4 — document upload
// ---------------------------------------------------------------------------
export async function uploadVisaDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), slotKey: z.string().min(1), memberId: z.string().uuid().nullable() })
    .safeParse({
      applicationId: formData.get("applicationId"),
      slotKey: formData.get("slotKey"),
      memberId: formData.get("memberId") || null,
    });
  if (!parsed.success) return { error: "Invalid upload request." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, or PDF files are accepted." };
  }

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(
    parsed.data.applicationId,
    user.id
  );
  if (!application) return { error: "This application can no longer be edited." };

  const slot = resolveUploadSlot(application, parsed.data.slotKey, parsed.data.memberId);
  if (!slot) return { error: "Unknown document type." };
  const maxBytes = slot.maxMb * 1024 * 1024 || MAX_UPLOAD_BYTES_DEFAULT;
  if (file.size > maxBytes) {
    return { error: `"${slot.label}" must be ${slot.maxMb}MB or smaller.` };
  }

  const storagePath = `${application.id}/${slot.key}-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  // Replace any previous upload in the same slot.
  const previous = previousUploads(application, slot);
  if (previous.length > 0) {
    await supabase.storage.from("visa-documents").remove(previous.map((p) => p.storage_path));
    await supabase
      .from("visa_documents")
      .delete()
      .in(
        "id",
        previous.map((p) => p.id)
      );
  }

  const { error: insertError } = await supabase.from("visa_documents").insert({
    application_id: application.id,
    document_type: slot.key,
    member_id: slot.memberId,
    storage_path: storagePath,
    uploaded_by: user.id,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/visa/apply/${application.id}`);
  return { error: null };
}

/**
 * Fills a document slot from the customer's vault instead of a fresh upload.
 *
 * The file is COPIED into visa-documents rather than referenced. Two reasons:
 * the vault is private to the customer and staff reviewing an application must
 * be able to read the attachment, and a submitted application has to keep the
 * exact document it was assessed on even if the customer later deletes or
 * replaces the vault original.
 *
 * Cross-bucket server-side copy isn't available (storage `copy` is same-bucket
 * only), so this downloads and re-uploads.
 */
export async function attachVaultDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      slotKey: z.string().min(1),
      memberId: z.string().uuid().nullable(),
      documentId: z.string().uuid(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      slotKey: formData.get("slotKey"),
      memberId: formData.get("memberId") || null,
      documentId: formData.get("documentId"),
    });
  if (!parsed.success) return { error: "Invalid request." };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(
    parsed.data.applicationId,
    user.id
  );
  if (!application) return { error: "This application can no longer be edited." };

  const slot = resolveUploadSlot(application, parsed.data.slotKey, parsed.data.memberId);
  if (!slot) return { error: "Unknown document type." };

  // owner_id in the predicate, not just RLS — this reads a different user's
  // table than the application, so the ownership check is explicit.
  const { data: vaultDoc } = await supabase
    .from("traveler_documents")
    .select("storage_path, file_name, file_size, content_type")
    .eq("id", parsed.data.documentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!vaultDoc) return { error: "That document is no longer in your vault." };

  if (vaultDoc.content_type && !ALLOWED_UPLOAD_TYPES.includes(vaultDoc.content_type)) {
    return { error: "Only JPG, PNG, or PDF files are accepted for visa applications." };
  }
  const maxBytes = slot.maxMb * 1024 * 1024 || MAX_UPLOAD_BYTES_DEFAULT;
  if (vaultDoc.file_size && vaultDoc.file_size > maxBytes) {
    return { error: `"${slot.label}" must be ${slot.maxMb}MB or smaller.` };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("traveler-documents")
    .download(vaultDoc.storage_path);
  if (downloadError || !blob) return { error: "Could not read that document from your vault." };

  const fileName = vaultDoc.file_name ?? `${slot.key}.bin`;
  const storagePath = `${application.id}/${slot.key}-${Date.now()}-${sanitizeFilename(fileName)}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, blob, { contentType: vaultDoc.content_type ?? blob.type });
  if (uploadError) return { error: uploadError.message };

  const previous = previousUploads(application, slot);
  if (previous.length > 0) {
    await supabase.storage.from("visa-documents").remove(previous.map((p) => p.storage_path));
    await supabase
      .from("visa_documents")
      .delete()
      .in(
        "id",
        previous.map((p) => p.id)
      );
  }

  const { error: insertError } = await supabase.from("visa_documents").insert({
    application_id: application.id,
    document_type: slot.key,
    member_id: slot.memberId,
    storage_path: storagePath,
    uploaded_by: user.id,
    file_name: fileName,
    file_size: vaultDoc.file_size,
    content_type: vaultDoc.content_type,
  });
  if (insertError) {
    await supabase.storage.from("visa-documents").remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath(`/visa/apply/${application.id}`);
  return { error: null };
}

export async function removeVisaDocument(formData: FormData): Promise<void> {
  const documentId = z.string().uuid().parse(formData.get("documentId"));
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));
  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId, user.id);
  if (!application) return;

  const doc = application.documents.find((d) => d.id === documentId);
  if (!doc) return;
  await supabase.storage.from("visa-documents").remove([doc.storage_path]);
  await supabase.from("visa_documents").delete().eq("id", doc.id);
  revalidatePath(`/visa/apply/${application.id}`);
}

export async function continueFromDocuments(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId.data, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const slots = applicationDocumentSlots(application);
  const uploadedKeys = new Set(application.documents.map((d) => d.document_type));
  const missing = [
    ...slots.filter((s) => s.required && !uploadedKeys.has(s.key)).map((s) => s.label),
    ...missingSectionFiles(application, parseRequirementSections(application.visa_type?.application_sections)),
  ];
  if (missing.length > 0) {
    return { error: `Please upload: ${missing.join(", ")}.` };
  }

  await supabase
    .from("visa_applications")
    .update({ current_step: Math.max(application.current_step, 5) })
    .eq("id", application.id);
  return advanceWizard(formData, application.id, 5);
}

// ---------------------------------------------------------------------------
// Step 5 → submit (then payment)
// ---------------------------------------------------------------------------
export async function submitVisaApplication(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  if (formData.get("confirmAccuracy") !== "on") {
    return { error: "Please confirm that all information is correct." };
  }
  if (formData.get("authorise") !== "on") {
    return { error: "Authorise STS to file the application to continue." };
  }

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(applicationId.data, user.id);
  if (!application) return { error: "This application can no longer be edited." };
  const visaType = application.visa_type;
  if (!visaType) return { error: "This visa service is no longer available." };

  if (visaType.terms_and_conditions && formData.get("agreeTerms") !== "on") {
    return { error: "Please agree to the Terms & Conditions to submit." };
  }

  // Completeness re-checks — the wizard enforces these step by step, but the
  // submit action is the gate that matters.
  const traveler = (application.traveler_details ?? {}) as Record<string, string>;
  const contact = (application.contact_details ?? {}) as Record<string, string>;
  const personal = personalInfoSchema.safeParse({
    fullName: traveler.full_name,
    dateOfBirth: traveler.date_of_birth,
    gender: traveler.gender,
    nationality: traveler.nationality,
    passportNumber: traveler.passport_number,
    passportExpiry: traveler.passport_expiry,
    placeOfBirth: traveler.place_of_birth,
    countryOfBirth: traveler.country_of_birth,
    maritalStatus: traveler.marital_status,
    email: contact.email,
    mobile: contact.mobile,
    occupation: traveler.occupation,
  });
  if (!personal.success) {
    return { error: `${personal.error.issues[0].message} Review step 2.` };
  }
  const travel = (application.travel_details ?? {}) as Record<string, string>;
  const travelCheck = travelInfoSchema.safeParse({
    arrivalDate: travel.arrival_date,
    departureDate: travel.departure_date,
    purposeOfVisit: travel.purpose,
    addressAtDestination: travel.address,
  });
  if (!travelCheck.success) {
    return { error: `${travelCheck.error.issues[0].message} Review step 3.` };
  }
  if (personal.data.passportExpiry <= travelCheck.data.departureDate) {
    return { error: "The passport expires before the departure date. Review step 2." };
  }
  const sections = parseRequirementSections(visaType.application_sections);
  const answersError = requirementAnswersError(
    sections,
    parseRequirementAnswers(application.custom_answers),
    orderedMembers(application.members)
  );
  if (answersError) return { error: `${answersError} Review step 3.` };

  const slots = applicationDocumentSlots(application);
  const uploadedKeys = new Set(application.documents.map((d) => d.document_type));
  const missing = [
    ...slots.filter((s) => s.required && !uploadedKeys.has(s.key)).map((s) => s.label),
    ...missingSectionFiles(application, sections),
  ];
  if (missing.length > 0) {
    return { error: `Missing documents: ${missing.join(", ")}.` };
  }

  // Price, fee, and the workflow snapshot are decided in SQL from the catalog
  // — never from values this request carries.
  const { error: consentError } = await supabase.rpc("visa_give_consent", {
    p_application_id: application.id,
    p_version: VISA_CONSENT_VERSION,
  });
  if (consentError) return { error: "Could not record your authorisation. Try again." };

  const { data: billed, error: submitError } = await supabase
    .rpc("submit_visa_application", { p_application_id: application.id })
    .single();
  if (submitError || !billed) return { error: submitError?.message ?? "Could not submit the application." };

  // A refused visa's STS fee comes back as credit on the next application.
  const { data: credit } = await supabase.rpc("visa_claim_reapply_credit", { p_application_id: application.id });
  const fee = Number(billed.fee_amount);
  const feeAfterCredit = Math.max(Math.round((fee - Number(credit ?? 0)) * 100) / 100, 0);

  let order: { id: string };
  try {
    order = await createOrderForBooking(supabase, {
      customerId: application.applicant_profile_id ?? user.id,
      bookedBy: user.id,
      agencyId: application.agency_id,
      agencyCustomerId: application.agency_customer_id,
      currency: billed.currency,
      itemType: "visa",
      price: Number(billed.price),
      feeAmount: feeAfterCredit,
      visaApplicationId: application.id,
    });
  } catch {
    if (Number(credit ?? 0) > 0) await supabase.rpc("visa_release_reapply_credit", { p_application_id: application.id });
    return { error: "Could not create the order. Try again." };
  }

  // Desk submissions settle on the agent portal's own order page (wallet
  // payment, same as every other vertical's desk flow) — never the public
  // checkout, which the agent's host-only session can't authenticate on.
  if (formData.get("desk") === "1") {
    return { error: null, destination: deskOrderPath(order.id) };
  }
  redirect(`/checkout/${order.id}`);
}

// ---------------------------------------------------------------------------
// Post-decision: upload an admin-requested document
// ---------------------------------------------------------------------------
export async function uploadRequestedDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({ requestId: z.string().uuid(), applicationId: z.string().uuid() })
    .safeParse({
      requestId: formData.get("requestId"),
      applicationId: formData.get("applicationId"),
    });
  if (!parsed.success) return { error: "Invalid request." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, or PDF files are accepted." };
  }
  if (file.size > MAX_UPLOAD_BYTES_DEFAULT) return { error: "Files must be 5MB or smaller." };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("visa_document_requests")
    .select("*, application:application_id (id, submitted_by)")
    .eq("id", parsed.data.requestId)
    .eq("application_id", parsed.data.applicationId)
    .maybeSingle();
  if (!request || request.application?.submitted_by !== user.id) {
    return { error: "This document request is not available." };
  }
  if (request.status !== "requested") return { error: "This document was already provided." };

  const storagePath = `${parsed.data.applicationId}/request-${request.id}-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: linkError } = await supabase.rpc("visa_fulfil_document_request", {
    p_request_id: request.id,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_file_size: file.size,
    p_content_type: file.type,
  });
  if (linkError) return { error: linkError.message };

  revalidatePath(`/account/visa/${parsed.data.applicationId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Replace a document STS rejected
// ---------------------------------------------------------------------------
export async function replaceRejectedDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({ documentId: z.string().uuid(), applicationId: z.string().uuid() })
    .safeParse({
      documentId: formData.get("documentId"),
      applicationId: formData.get("applicationId"),
    });
  if (!parsed.success) return { error: "Invalid request." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, or PDF files are accepted." };
  }
  if (file.size > MAX_UPLOAD_BYTES_DEFAULT) return { error: "Files must be 5MB or smaller." };

  await requireUser();
  const supabase = await createClient();

  const storagePath = `${parsed.data.applicationId}/replace-${parsed.data.documentId}-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  // Inserts a new version; the rejected one is kept, with its reason. The
  // ownership check and the hand-back to review happen in the RPC.
  const { error } = await supabase.rpc("visa_replace_document", {
    p_document_id: parsed.data.documentId,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_file_size: file.size,
    p_content_type: file.type,
  });
  if (error) return { error: error.message };

  revalidatePath(`/account/visa/${parsed.data.applicationId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Message STS about a submitted application
// ---------------------------------------------------------------------------
export async function sendVisaMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), body: z.string().trim().min(1, "Write a message.").max(4000) })
    .safeParse({ applicationId: formData.get("applicationId"), body: formData.get("body") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_send_message", {
    p_application_id: parsed.data.applicationId,
    p_body: parsed.data.body,
  });
  if (error) return { error: error.message };
  revalidatePath(`/account/visa/${parsed.data.applicationId}`);
  revalidatePath(`/admin/visa/${parsed.data.applicationId}`);
  return { error: null };
}

/** "Apply again" after a refusal: a new draft with the details copied; documents are uploaded fresh. */
export async function reapplyVisa(formData: FormData): Promise<void> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return;
  await requireUser();
  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("visa_reapply", { p_application_id: applicationId.data });
  if (error || !newId) redirect(`/account/visa/${applicationId.data}`);
  redirect(`/visa/apply/${newId}?step=1`);
}
