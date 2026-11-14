"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireVisaPermission } from "./staff-auth";
import { zonedLocalToUtc } from "./time";
import { notifyVisaCustomer } from "./notify";
import { getApplicationDetail } from "./queries";
import { submitToPartner, syncPartnerStatus, mapPartnerStatus } from "./partner/registry";
import { parkForUnmappedPartnerStatus, parkForRefusedPartnerTransition } from "./partner/sync";
import type { Json } from "@/lib/types/database.types";

export type ActionState = { error: string | null; requiresRefresh?: boolean } | null;

function revalidateVisaViews(applicationId: string) {
  revalidatePath("/admin/visa");
  revalidatePath(`/admin/visa/${applicationId}`);
  revalidatePath(`/account/visa/${applicationId}`);
}

/** "cannot clear x — y" style RPC exceptions → one plain sentence. */
function rpcMessage(message: string) {
  const text = message.replace(/^.*?ERROR:\s*/, "").trim();
  return text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : ".");
}

const applicationIdSchema = z.string().uuid();

/** Submitted → document review. */
export async function adminStartReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = applicationIdSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  await requireVisaPermission("visa.documents.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_start_review", { p_application_id: applicationId.data });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(applicationId.data);
  return { error: null };
}

/** Action required → back to review (or processing, when the chase happened there). */
export async function adminResumeCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = applicationIdSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  await requireVisaPermission("visa.documents.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_resume_case", {
    p_application_id: applicationId.data,
    p_note: formData.get("note")?.toString().trim() || undefined,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(applicationId.data);
  return { error: null };
}

/** Document review → ready for submission; refused while anything is outstanding. */
export async function adminMarkReady(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = applicationIdSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  await requireVisaPermission("visa.documents.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_mark_ready", {
    p_application_id: applicationId.data,
    p_note: formData.get("note")?.toString().trim() || undefined,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(applicationId.data);
  return { error: null };
}

export async function adminCancelCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), reason: z.string().trim().min(5, "Enter a reason.") })
    .safeParse({ applicationId: formData.get("applicationId"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await requireVisaPermission("visa.case.cancel");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_cancel_case", {
    p_application_id: parsed.data.applicationId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/** Ask the applicant for an additional document. */
export async function adminRequestDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      title: z.string().trim().min(2, "Enter a document name."),
      description: z.string().max(1000).optional(),
      requirement: z.enum(["required", "optional"]),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      title: formData.get("title"),
      description: formData.get("description")?.toString().trim() || undefined,
      requirement: formData.get("requirement") ?? "required",
      dueDate: formData.get("dueDate")?.toString().trim() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.documents.request");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_request_document", {
    p_application_id: parsed.data.applicationId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_requirement: parsed.data.requirement,
    p_due_date: parsed.data.dueDate,
  });
  if (error) return { error: rpcMessage(error.message) };
  if (parsed.data.requirement === "required") {
    after(() => notifyVisaCustomer(parsed.data.applicationId, "documents_requested", `Please upload: ${parsed.data.title}.`));
  }

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/**
 * Accept or reject the current version of one document. A rejection puts the
 * case back in front of the applicant; the RPC records where to resume.
 */
export async function adminReviewDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      documentId: z.string().uuid(),
      applicationId: z.string().uuid(),
      decision: z.enum(["accept", "reject"]),
      reason: z.string().max(2000).optional(),
    })
    .safeParse({
      documentId: formData.get("documentId"),
      applicationId: formData.get("applicationId"),
      decision: formData.get("decision"),
      reason: formData.get("reason")?.toString().trim() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // One "check:<key>" field per standard check: "pass" or "fail".
  const checks: Record<string, boolean> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("check:")) checks[name.slice(6)] = value === "pass";
  }
  const failed = Object.values(checks).some((ok) => !ok);
  if (parsed.data.decision === "reject" && !parsed.data.reason && !failed) {
    return { error: "Mark the failed checks or enter what is wrong." };
  }

  await requireVisaPermission("visa.documents.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_review_document", {
    p_document_id: parsed.data.documentId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason,
    p_checks: checks,
  });
  if (error) return { error: rpcMessage(error.message) };
  if (parsed.data.decision === "reject") {
    const { data: doc } = await supabase.from("visa_documents").select("rejection_reason").eq("id", parsed.data.documentId).maybeSingle();
    after(() => notifyVisaCustomer(
      parsed.data.applicationId,
      "documents_requested",
      `A document needs to be replaced: ${doc?.rejection_reason ?? parsed.data.reason ?? ""}`
    ));
  }

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/** Append a staff-internal note (never shown to the applicant). */
export async function adminAddInternalNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), note: z.string().trim().min(1, "Enter a note.").max(4000) })
    .safeParse({ applicationId: formData.get("applicationId"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = await requireVisaPermission("visa.notes.write");
  const supabase = await createClient();
  const { error } = await supabase.from("visa_processing_notes").insert({
    application_id: parsed.data.applicationId,
    note: parsed.data.note,
    created_by: admin.id,
  });
  if (error) return { error: rpcMessage(error.message) };

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/** Mark a requested document received (accepting its upload) or waive it. */
export async function adminResolveDocumentRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireVisaPermission("visa.documents.review");
  const parsed = z
    .object({
      requestId: z.string().uuid(),
      applicationId: z.string().uuid(),
      resolution: z.enum(["received", "waived"]),
    })
    .parse({
      requestId: formData.get("requestId"),
      applicationId: formData.get("applicationId"),
      resolution: formData.get("resolution"),
    });

  const supabase = await createClient();
  const { data: request, error: requestError } = await supabase.from("visa_document_requests")
    .select("application_id,status,document_id").eq("id", parsed.requestId).eq("application_id", parsed.applicationId).maybeSingle();
  if (requestError || !request) return { error: "Document request could not be loaded." };
  if (parsed.resolution === "received" && (request.status !== "uploaded" || !request.document_id)) return { error: "The customer must upload the document before it can be verified." };
  const { error } = await supabase.rpc("visa_resolve_document_request", {
    p_request_id: parsed.requestId,
    p_resolution: parsed.resolution,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.applicationId);
  return { error: null };
}

/** Attach the final visa document (shown as "Download Visa" to the customer). */
export async function adminUploadResultDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 10 * 1024 * 1024) return { error: "Files must be 10MB or smaller." };

  await requireVisaPermission("visa.decision.record");
  const supabase = await createClient();

  const storagePath = `${applicationId.data}/visa-result-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.rpc("visa_attach_result_document", {
    p_application_id: applicationId.data,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_file_size: file.size,
    p_content_type: file.type || undefined,
  });
  if (error) {
    await supabase.storage.from("visa-documents").remove([storagePath]);
    return { error: rpcMessage(error.message) };
  }

  revalidateVisaViews(applicationId.data);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Staff files (decision letter, submission receipt, collection authorisation)
// ---------------------------------------------------------------------------
type StaffDocType = "decision_letter" | "submission_receipt" | "passport_authorization";
const STAFF_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

async function uploadStaffFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  type: StaffDocType,
  file: FormDataEntryValue | null
): Promise<{ id: string | null; error: string | null }> {
  if (!(file instanceof File) || file.size === 0) return { id: null, error: null };
  if (!STAFF_FILE_TYPES.includes(file.type)) return { id: null, error: "Only PDF, JPG, or PNG files are accepted." };
  if (file.size > 10 * 1024 * 1024) return { id: null, error: "Files must be 10MB or smaller." };

  const path = `${applicationId}/${type}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("visa-documents").upload(path, file, { contentType: file.type });
  if (uploadError) return { id: null, error: uploadError.message };

  const { data, error } = await supabase.rpc("visa_attach_staff_document", {
    p_application_id: applicationId,
    p_document_type: type,
    p_storage_path: path,
    p_file_name: file.name,
    p_file_size: file.size,
    p_content_type: file.type,
  });
  if (error || !data) {
    await supabase.storage.from("visa-documents").remove([path]);
    return { id: null, error: rpcMessage(error?.message ?? "Upload failed") };
  }
  return { id: data, error: null };
}

const optionalText = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
async function centreTimezone(supabase: Awaited<ReturnType<typeof createClient>>, centreId: string) {
  const { data } = await supabase.from("visa_application_centres").select("timezone").eq("id", centreId).maybeSingle();
  return data?.timezone ?? "Africa/Mogadishu";
}

export async function adminBookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      centreId: z.string().uuid("Choose a centre."),
      type: z.enum(["submission", "biometrics", "interview", "collection"]),
      scheduledAt: z.string().min(1, "Choose a date and time."),
      memberId: z.string().uuid().optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      centreId: formData.get("centreId"),
      type: formData.get("type"),
      scheduledAt: formData.get("scheduledAt"),
      memberId: optionalText(formData.get("memberId")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.appointments.manage");
  const supabase = await createClient();
  const scheduledAt = zonedLocalToUtc(parsed.data.scheduledAt, await centreTimezone(supabase, parsed.data.centreId));
  if (!scheduledAt) return { error: "Choose a date and time." };

  const { error } = await supabase.rpc("visa_book_appointment", {
    p_application_id: parsed.data.applicationId,
    p_centre_id: parsed.data.centreId,
    p_type: parsed.data.type,
    p_scheduled_at: scheduledAt,
    p_confirmation: optionalText(formData.get("confirmation")),
    p_biometrics_required: formData.get("biometricsRequired") === "on",
    p_member_id: parsed.data.memberId,
  });
  if (error) return { error: rpcMessage(error.message) };
  await notifyVisaCustomer(parsed.data.applicationId, "appointment_booked", "Your appointment details are in your account.");
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminRescheduleAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      appointmentId: z.string().uuid(),
      centreId: z.string().uuid(),
      scheduledAt: z.string().min(1, "Choose a date and time."),
      reason: z.string().trim().min(3, "Enter a reason."),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      appointmentId: formData.get("appointmentId"),
      centreId: formData.get("centreId"),
      scheduledAt: formData.get("scheduledAt"),
      reason: formData.get("reason") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.appointments.manage");
  const supabase = await createClient();
  const scheduledAt = zonedLocalToUtc(parsed.data.scheduledAt, await centreTimezone(supabase, parsed.data.centreId));
  if (!scheduledAt) return { error: "Choose a date and time." };

  const { error } = await supabase.rpc("visa_reschedule_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_scheduled_at: scheduledAt,
    p_reason: parsed.data.reason,
    p_confirmation: optionalText(formData.get("confirmation")),
    p_centre_id: parsed.data.centreId,
  });
  if (error) return { error: rpcMessage(error.message) };
  await notifyVisaCustomer(parsed.data.applicationId, "appointment_booked", "Your appointment was moved. The new time is in your account.");
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminCancelAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      appointmentId: z.string().uuid(),
      reason: z.string().trim().min(3, "Enter a reason."),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      appointmentId: formData.get("appointmentId"),
      reason: formData.get("reason") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.appointments.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_cancel_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminRecordAppointmentOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      appointmentId: z.string().uuid(),
      outcome: z.enum(["attended", "no_show"]),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      appointmentId: formData.get("appointmentId"),
      outcome: formData.get("outcome"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.appointments.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_record_appointment_outcome", {
    p_appointment_id: parsed.data.appointmentId,
    p_outcome: parsed.data.outcome,
    p_biometrics_completed: formData.get("biometricsCompleted") === "on",
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  revalidatePath("/admin/visa/appointments");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Submission + processing
// ---------------------------------------------------------------------------
export async function adminRecordSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      centreId: z.string().uuid().optional(),
      lodgedWith: z.string().trim().optional(),
      reference: z.string().trim().min(1, "Enter the submission reference."),
      submittedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the submission date."),
      appointmentId: z.string().uuid().optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      centreId: optionalText(formData.get("centreId")),
      lodgedWith: optionalText(formData.get("lodgedWith")),
      reference: formData.get("reference") ?? "",
      submittedOn: formData.get("submittedOn") ?? "",
      appointmentId: optionalText(formData.get("appointmentId")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!parsed.data.centreId && !parsed.data.lodgedWith) return { error: "Choose a centre or enter where it was lodged." };

  const receiptFile = formData.get("receipt");
  if (!(receiptFile instanceof File) || receiptFile.size === 0) return { error: "Attach the submission receipt." };

  await requireVisaPermission("visa.submission.record");
  const supabase = await createClient();
  const receipt = await uploadStaffFile(supabase, parsed.data.applicationId, "submission_receipt", receiptFile);
  if (receipt.error) return { error: receipt.error };

  const { error } = await supabase.rpc("visa_record_submission", {
    p_application_id: parsed.data.applicationId,
    p_lodged_with: parsed.data.lodgedWith ?? "",
    p_reference: parsed.data.reference,
    p_submitted_on: parsed.data.submittedOn,
    p_centre_id: parsed.data.centreId,
    p_appointment_id: parsed.data.appointmentId,
    p_receipt_document_id: receipt.id ?? undefined,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminUpdateSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      centreStatus: z.enum(["accepted", "returned_for_correction"]),
      reason: z.string().trim().optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      centreStatus: formData.get("centreStatus"),
      reason: optionalText(formData.get("reason")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.submission.record");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_update_submission", {
    p_application_id: parsed.data.applicationId,
    p_centre_status: parsed.data.centreStatus,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminRecordProcessingUpdate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      stage: z.enum(["in_centre", "in_authority", "awaiting_decision"]),
    })
    .safeParse({ applicationId: formData.get("applicationId"), stage: formData.get("stage") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.processing.update");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_record_processing_update", {
    p_application_id: parsed.data.applicationId,
    p_processing_stage: parsed.data.stage,
    p_note: optionalText(formData.get("note")),
    p_customer_note: optionalText(formData.get("customerNote")),
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------
export async function adminRecordDecision(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      outcome: z.enum(["approved", "refused"]),
      authority: z.string().trim().min(2, "Enter the issuing authority."),
      reference: z.string().trim().optional(),
      decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the decision date."),
      notes: z.string().trim().max(2000).optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      outcome: formData.get("outcome"),
      authority: formData.get("authority") ?? "",
      reference: optionalText(formData.get("reference")),
      decisionDate: formData.get("decisionDate") ?? "",
      notes: optionalText(formData.get("notes")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.decision.record");
  const supabase = await createClient();
  const letter = await uploadStaffFile(supabase, parsed.data.applicationId, "decision_letter", formData.get("letter"));
  if (letter.error) return { error: letter.error };
  if (!parsed.data.reference && !letter.id) return { error: "Enter the authority's reference or attach the decision letter." };
  if (parsed.data.outcome === "refused" && !letter.id) return { error: "Attach the refusal letter." };

  const { error } = await supabase.rpc("visa_record_decision", {
    p_application_id: parsed.data.applicationId,
    p_outcome: parsed.data.outcome,
    p_authority: parsed.data.authority,
    p_reference: parsed.data.reference,
    p_decision_date: parsed.data.decisionDate,
    p_letter_document_id: letter.id ?? undefined,
    p_notes: parsed.data.notes,
  });
  if (error) return { error: rpcMessage(error.message) };
  await notifyVisaCustomer(
    parsed.data.applicationId,
    "decision_recorded",
    parsed.data.outcome === "approved" ? "Your visa was approved." : "Your visa application was refused."
  );
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminCorrectDecision(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      decisionId: z.string().uuid(),
      outcome: z.enum(["approved", "refused"]),
      reason: z.string().trim().min(10, "Explain the correction (at least 10 characters)."),
      reference: z.string().trim().optional(),
      decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      decisionId: formData.get("decisionId"),
      outcome: formData.get("outcome"),
      reason: formData.get("reason") ?? "",
      reference: optionalText(formData.get("reference")),
      decisionDate: optionalText(formData.get("decisionDate")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.decision.correct");
  const supabase = await createClient();
  const letter = await uploadStaffFile(supabase, parsed.data.applicationId, "decision_letter", formData.get("letter"));
  if (letter.error) return { error: letter.error };

  const { error } = await supabase.rpc("correct_visa_decision", {
    p_decision_id: parsed.data.decisionId,
    p_outcome: parsed.data.outcome,
    p_reason: parsed.data.reason,
    p_reference: parsed.data.reference,
    p_decision_date: parsed.data.decisionDate,
    p_letter_document_id: letter.id ?? undefined,
  });
  if (error) return { error: rpcMessage(error.message) };
  await notifyVisaCustomer(
    parsed.data.applicationId,
    "decision_recorded",
    parsed.data.outcome === "approved" ? "The decision was corrected: approved." : "The decision was corrected: refused."
  );
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Passports
// ---------------------------------------------------------------------------
export async function adminRecordPassportEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      passportId: z.string().uuid(),
      toStatus: z.enum([
        "with_applicant",
        "with_sts",
        "with_centre",
        "in_transit",
        "ready_for_collection",
        "out_for_delivery",
        "delivered",
        "collected",
      ]),
      deliveryMode: z.enum(["counter", "courier", "third_party"]).optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      passportId: formData.get("passportId"),
      toStatus: formData.get("toStatus"),
      deliveryMode: optionalText(formData.get("deliveryMode")),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.passport.manage");
  const supabase = await createClient();
  const authorization = await uploadStaffFile(
    supabase,
    parsed.data.applicationId,
    "passport_authorization",
    formData.get("authorization")
  );
  if (authorization.error) return { error: authorization.error };

  const { error } = await supabase.rpc("visa_record_passport_event", {
    p_passport_id: parsed.data.passportId,
    p_to_status: parsed.data.toStatus,
    p_delivery_mode: parsed.data.deliveryMode,
    p_reference: optionalText(formData.get("reference")),
    p_collector_name: optionalText(formData.get("collectorName")),
    p_authorization_document_id: authorization.id ?? undefined,
    p_note: optionalText(formData.get("note")),
  });
  if (error) return { error: rpcMessage(error.message) };
  if (parsed.data.toStatus === "ready_for_collection" || parsed.data.toStatus === "out_for_delivery") {
    await notifyVisaCustomer(
      parsed.data.applicationId,
      "passport_ready",
      parsed.data.toStatus === "ready_for_collection" ? "Your passport is ready for collection." : "Your passport is out for delivery."
    );
  }
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Partner processing — hand the case to the visa type's configured partner.
// A failure is recorded on the case and the manual lodgement stays available.
// ---------------------------------------------------------------------------
export async function adminSubmitToPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };

  await requireVisaPermission("visa.submission.record");
  const application = await getApplicationDetail(applicationId.data);
  if (!application) return { error: "Application not found." };
  if (application.visa_type?.processing_mode !== "partner" || !application.visa_type.partner_provider_key) {
    return { error: "This visa type isn't configured for partner processing." };
  }
  if (application.status !== "ready_for_processing") {
    return { error: "Mark the application ready for submission first." };
  }
  const providerKey = application.visa_type.partner_provider_key;

  const supabase = await createClient();
  const result = await submitToPartner(providerKey, { application });

  if (result.type === "error") {
    await supabase.rpc("visa_record_partner_failure", {
      p_application_id: applicationId.data,
      p_provider_key: providerKey,
      p_reason: result.message,
    });
    revalidateVisaViews(applicationId.data);
    return { error: result.message };
  }

  const { error } = await supabase.rpc("visa_record_partner_submission", {
    p_application_id: applicationId.data,
    p_provider_key: providerKey,
    p_partner_ref: result.partnerRef,
    p_partner_status: result.status ?? undefined,
  });
  if (error) return { error: rpcMessage(error.message) };

  revalidateVisaViews(applicationId.data);
  return { error: null };
}

/**
 * Pulls the partner's latest status. The raw status is always recorded; a
 * changed one is mapped and applied (approved / refused become a
 * partner-sourced decision). Unmapped or refused updates are parked for staff.
 */
export async function adminSyncPartnerStatus(formData: FormData): Promise<void> {
  await requireVisaPermission("visa.submission.record");
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("visa_applications")
    .select("application_ref, partner_provider_key, partner_ref, partner_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application?.partner_provider_key || !application.partner_ref) return;

  const result = await syncPartnerStatus(
    application.partner_provider_key,
    application.partner_ref,
    application.partner_status
  );
  if (result.type !== "status") {
    revalidateVisaViews(applicationId);
    return;
  }

  const rawPayload = result.raw ? (JSON.parse(JSON.stringify(result.raw)) as Json) : null;
  await supabase.rpc("visa_record_partner_status", {
    p_application_id: applicationId,
    p_partner_status: result.status,
    p_raw: rawPayload ?? undefined,
  });

  if (result.status !== application.partner_status) {
    const mapped = await mapPartnerStatus(application.partner_provider_key, result.status);
    if (mapped.type === "mapped") {
      const { error: transitionError } = await supabase.rpc("visa_sync_partner_status", {
        p_application_id: applicationId,
        p_status: mapped.status,
      });
      if (transitionError) {
        await parkForRefusedPartnerTransition(
          supabase,
          applicationId,
          application.application_ref,
          application.partner_provider_key,
          result.status,
          transitionError.message
        );
      }
    } else {
      await parkForUnmappedPartnerStatus(
        supabase,
        applicationId,
        application.application_ref,
        application.partner_provider_key,
        result.status
      );
    }
  }

  revalidateVisaViews(applicationId);
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------
export async function adminAssignCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), assignee: z.union([z.string().uuid(), z.literal("")]) })
    .safeParse({ applicationId: formData.get("applicationId"), assignee: formData.get("assignee") ?? "" });
  if (!parsed.success) return { error: "Choose a staff member." };

  await requireVisaPermission("visa.assign");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_assign_case", {
    p_application_id: parsed.data.applicationId,
    p_assignee: parsed.data.assignee || (null as unknown as string),
  });
  if (error) return { error: rpcMessage(error.message) };
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

export async function adminClaimCase(formData: FormData): Promise<void> {
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));
  await requireVisaPermission("visa.applications.edit");
  const supabase = await createClient();
  await supabase.rpc("visa_claim_case", { p_application_id: applicationId });
  revalidateVisaViews(applicationId);
}

export async function adminSetCasePriority(formData: FormData): Promise<void> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), priority: z.enum(["normal", "urgent"]) })
    .parse({ applicationId: formData.get("applicationId"), priority: formData.get("priority") });
  await requireVisaPermission("visa.assign");
  const supabase = await createClient();
  await supabase.rpc("visa_set_case_priority", {
    p_application_id: parsed.applicationId,
    p_priority: parsed.priority,
  });
  revalidateVisaViews(parsed.applicationId);
}

// ---------------------------------------------------------------------------
// Messages (visible to the applicant — internal notes stay in notes)
// ---------------------------------------------------------------------------
export async function adminSendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applicationId: z.string().uuid(), body: z.string().trim().min(1, "Write a message.").max(4000) })
    .safeParse({ applicationId: formData.get("applicationId"), body: formData.get("body") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireVisaPermission("visa.messages.send");
  const supabase = await createClient();
  const { error } = await supabase.rpc("visa_send_message", {
    p_application_id: parsed.data.applicationId,
    p_body: parsed.data.body,
  });
  if (error) return { error: rpcMessage(error.message) };
  await notifyVisaCustomer(
    parsed.data.applicationId,
    "message",
    parsed.data.body.length > 200 ? `${parsed.data.body.slice(0, 197)}…` : parsed.data.body
  );
  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}
