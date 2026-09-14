"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getApplicationDetail } from "./queries";
import { submitToPartner, syncPartnerStatus, mapPartnerStatus } from "./partner/registry";
import { parkForUnmappedPartnerStatus, parkForRefusedPartnerTransition } from "./partner/sync";
import { VISA_STATUS_LABELS } from "./schemas";
import type { Json } from "@/lib/types/database.types";

export type ActionState = { error: string | null } | null;

const DECISION_STATUSES = [
  "submitted",
  "in_review",
  "additional_info_required",
  "ready_for_processing",
  "processing",
  "approved",
  "rejected",
  "issued",
  "cancelled",
] as const;

function revalidateVisaViews(applicationId: string) {
  revalidatePath("/admin/visa");
  revalidatePath(`/admin/visa/${applicationId}`);
  revalidatePath(`/account/visa/${applicationId}`);
}

/** Move an application through the workflow; the DB trigger logs history. */
export async function adminSetVisaStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      status: z.enum(DECISION_STATUSES),
      note: z.string().max(2000).optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      status: formData.get("status"),
      note: formData.get("note")?.toString().trim() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requirePlatformAdmin();
  const supabase = await createClient();

  // set_visa_application_status is the only writer of this column (a trigger
  // rejects direct updates): it validates the transition, stamps the decision,
  // carries the note onto the history row, and notifies the applicant, the
  // agency, and — on arrival — admins.
  const { error } = await supabase.rpc("set_visa_application_status", {
    p_application_id: parsed.data.applicationId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) {
    // The status control only ever offers legal next states, so this should
    // be unreachable in normal use — but if two admins race on the same
    // application, translate the RPC's raw exception into the same wording
    // rather than leaking Postgres error text into the console UI.
    const transitionError = error.message.match(/cannot move from (\w+) to (\w+)/);
    if (transitionError) {
      const [, from, to] = transitionError;
      return {
        error: `This application moved to "${VISA_STATUS_LABELS[from] ?? from}" while you were viewing it — refresh to see valid next steps for "${VISA_STATUS_LABELS[to] ?? to}".`,
      };
    }
    return { error: error.message };
  }

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
      title: z.string().min(2, "Enter a document name."),
      description: z.string().max(1000).optional(),
      requirement: z.enum(["required", "optional"]),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      title: formData.get("title"),
      description: formData.get("description")?.toString().trim() || undefined,
      requirement: formData.get("requirement") ?? "required",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("visa_document_requests").insert({
    application_id: parsed.data.applicationId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    requirement: parsed.data.requirement,
    requested_by: admin.id,
  });
  if (error) return { error: error.message };

  // Legal from either 'submitted' or 'in_review' — asking for a document is
  // itself the act of reviewing.
  const { error: statusError } = await supabase.rpc("set_visa_application_status", {
    p_application_id: parsed.data.applicationId,
    p_status: "additional_info_required",
    p_note: parsed.data.title,
  });
  if (statusError) return { error: statusError.message };

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/**
 * Accept or reject one uploaded document. A rejection carries the reason back
 * to the applicant and puts the application in front of them again; the
 * ready_for_processing trigger keeps it from being lodged until it is replaced.
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

  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const rejecting = parsed.data.decision === "reject";
  if (rejecting && !parsed.data.reason) {
    return { error: "Enter what is wrong with this document." };
  }

  // Accepting a rejected document without a new upload would clear the
  // rejection with nothing behind it — the applicant has to replace the file
  // (which resets review_status to 'pending') before it can go to 'accepted'.
  if (!rejecting) {
    const { data: document } = await supabase
      .from("visa_documents")
      .select("review_status")
      .eq("id", parsed.data.documentId)
      .maybeSingle();
    if (document?.review_status === "rejected") {
      return { error: "This document was rejected. The applicant must upload a replacement first." };
    }
  }

  // A rejection that cannot move the application is a half-write: the document
  // would be marked rejected while the status transition fails underneath it.
  const { data: application } = await supabase
    .from("visa_applications")
    .select("status")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();
  const decided = ["approved", "rejected", "issued", "cancelled"].includes(application?.status ?? "");
  if (rejecting && decided) {
    return { error: "This application is already decided." };
  }

  const { error } = await supabase
    .from("visa_documents")
    .update({
      review_status: rejecting ? "rejected" : "accepted",
      rejection_reason: rejecting ? parsed.data.reason! : null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.documentId)
    .eq("application_id", parsed.data.applicationId);
  if (error) return { error: error.message };

  if (rejecting) {
    // Legal from either 'submitted' or 'in_review' — rejecting a document is
    // itself the act of reviewing.
    const { error: statusError } = await supabase.rpc("set_visa_application_status", {
      p_application_id: parsed.data.applicationId,
      p_status: "additional_info_required",
      p_note: parsed.data.reason,
    });
    if (statusError) return { error: statusError.message };
  }

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/**
 * Lodge an application with an embassy/consulate/authorised channel and move
 * it into 'processing' in one step — the guard trigger refuses the status
 * change unless this job's lodged_with/lodgement_reference are already
 * written, so the two always happen together.
 */
export async function adminStartManualProcessing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      applicationId: z.string().uuid(),
      lodgedWith: z.string().min(2, "Enter who this was lodged with."),
      lodgementReference: z.string().min(1, "Enter the lodgement reference."),
      lodgementDate: z.string().min(1, "Enter the lodgement date."),
      appointmentDate: z.string().optional(),
    })
    .safeParse({
      applicationId: formData.get("applicationId"),
      lodgedWith: formData.get("lodgedWith"),
      lodgementReference: formData.get("lodgementReference"),
      lodgementDate: formData.get("lodgementDate"),
      appointmentDate: formData.get("appointmentDate")?.toString().trim() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  // A re-lodge (an application that already came back once) supersedes its
  // prior attempt rather than leaving two rows both claiming to be active.
  await supabase
    .from("visa_processing_jobs")
    .update({ status: "superseded" })
    .eq("application_id", parsed.data.applicationId)
    .eq("status", "active");

  const { error: jobError } = await supabase.from("visa_processing_jobs").insert({
    application_id: parsed.data.applicationId,
    route: "manual",
    lodged_with: parsed.data.lodgedWith,
    lodgement_reference: parsed.data.lodgementReference,
    lodgement_date: parsed.data.lodgementDate,
    appointment_date: parsed.data.appointmentDate || null,
    created_by: admin.id,
  });
  if (jobError) return { error: jobError.message };

  const { error: statusError } = await supabase.rpc("set_visa_application_status", {
    p_application_id: parsed.data.applicationId,
    p_status: "processing",
  });
  if (statusError) return { error: statusError.message };

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
}

/** Record the appointment date on the active manual job once it's known. */
export async function adminUpdateManualAppointment(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = z
    .object({ applicationId: z.string().uuid(), appointmentDate: z.string().min(1) })
    .parse({
      applicationId: formData.get("applicationId"),
      appointmentDate: formData.get("appointmentDate"),
    });

  const supabase = await createClient();
  await supabase
    .from("visa_processing_jobs")
    .update({ appointment_date: parsed.appointmentDate })
    .eq("application_id", parsed.applicationId)
    .eq("status", "active")
    .eq("route", "manual");

  revalidateVisaViews(parsed.applicationId);
}

/** Append a staff-internal note to an application's processing log. */
export async function adminAddProcessingNote(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const parsed = z
    .object({ applicationId: z.string().uuid(), note: z.string().min(1, "Enter a note.") })
    .parse({
      applicationId: formData.get("applicationId"),
      note: formData.get("note")?.toString().trim(),
    });

  const supabase = await createClient();
  await supabase.from("visa_processing_notes").insert({
    application_id: parsed.applicationId,
    note: parsed.note,
    created_by: admin.id,
  });

  revalidateVisaViews(parsed.applicationId);
}

/** Accept or waive a requested document; auto-advance once none are outstanding. */
export async function adminResolveDocumentRequest(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
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
  await supabase
    .from("visa_document_requests")
    .update({ status: parsed.resolution })
    .eq("id", parsed.requestId);

  const { data: outstanding } = await supabase
    .from("visa_document_requests")
    .select("id")
    .eq("application_id", parsed.applicationId)
    .eq("requirement", "required")
    .in("status", ["requested", "uploaded"]);
  // Nothing outstanding puts the application back in front of a reviewer, who
  // then clears it for processing. It used to jump straight to 'processing',
  // which claimed the application had been lodged when nobody had lodged it.
  if ((outstanding ?? []).length === 0) {
    const { data: current } = await supabase
      .from("visa_applications")
      .select("status")
      .eq("id", parsed.applicationId)
      .maybeSingle();
    if (current?.status === "additional_info_required") {
      await supabase.rpc("set_visa_application_status", {
        p_application_id: parsed.applicationId,
        p_status: "in_review",
      });
    }
  }

  revalidateVisaViews(parsed.applicationId);
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

  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const storagePath = `${applicationId.data}/visa-result-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("visa-documents")
    .upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("visa_documents").insert({
    application_id: applicationId.data,
    document_type: "visa_result",
    storage_path: storagePath,
    uploaded_by: admin.id,
    review_status: "accepted",
    file_name: file.name,
    file_size: file.size,
    content_type: file.type || null,
  });
  if (error) return { error: error.message };

  revalidateVisaViews(applicationId.data);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Partner processing — hand an application off to whichever partner the
// application's visa type is configured for (visa_types.partner_provider_key).
// ---------------------------------------------------------------------------

/**
 * Submits, records the attempt as a processing job either way, and — on
 * success — moves the application into 'processing' through the same door
 * every status change goes through. A failure is recorded, not swallowed:
 * the application stays exactly where it was, and the manual workspace
 * (always rendered alongside this one) is the honest fallback — nothing
 * here decides for staff that the partner attempt is retryable or not.
 */
export async function adminSubmitToPartner(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };

  const admin = await requirePlatformAdmin();
  const application = await getApplicationDetail(applicationId.data);
  if (!application) return { error: "Application not found." };
  if (application.visa_type?.processing_mode !== "partner" || !application.visa_type.partner_provider_key) {
    return { error: "This visa type isn't configured for partner processing." };
  }
  if (application.status !== "ready_for_processing") {
    return { error: "Clear this application for processing before submitting it to a partner." };
  }
  const providerKey = application.visa_type.partner_provider_key;

  const supabase = await createClient();
  const result = await submitToPartner(providerKey, { application });

  if (result.type === "error") {
    await supabase.from("visa_processing_jobs").insert({
      application_id: applicationId.data,
      route: "partner",
      provider_key: providerKey,
      status: "failed",
      failure_reason: result.message,
      created_by: admin.id,
    });
    // Surfaced in the notes feed under the manual fallback card, which is
    // always rendered next to partner processing — staff see why they're
    // being offered it, not just that they are.
    await supabase.from("visa_processing_notes").insert({
      application_id: applicationId.data,
      note: `Partner submission (${providerKey}) failed: ${result.message}`,
      created_by: admin.id,
    });
    revalidateVisaViews(applicationId.data);
    return { error: result.message };
  }

  await supabase
    .from("visa_processing_jobs")
    .update({ status: "superseded" })
    .eq("application_id", applicationId.data)
    .eq("status", "active");

  const { error: jobError } = await supabase.from("visa_processing_jobs").insert({
    application_id: applicationId.data,
    route: "partner",
    provider_key: providerKey,
    partner_ref: result.partnerRef,
    partner_status: result.status ?? null,
    partner_last_synced_at: new Date().toISOString(),
    created_by: admin.id,
  });
  if (jobError) return { error: jobError.message };

  // Mirrored onto visa_applications too — PartnerControl reads its display
  // data from there, unchanged since before this milestone.
  await supabase
    .from("visa_applications")
    .update({
      partner_provider_key: providerKey,
      partner_ref: result.partnerRef,
      partner_status: result.status ?? null,
      partner_last_synced_at: new Date().toISOString(),
    })
    .eq("id", applicationId.data);

  const { error: statusError } = await supabase.rpc("set_visa_application_status", {
    p_application_id: applicationId.data,
    p_status: "processing",
  });
  if (statusError) return { error: statusError.message };

  revalidateVisaViews(applicationId.data);
  return { error: null };
}

/**
 * Pulls the latest status from the partner. A changed status is mapped onto
 * our own status and driven through set_visa_application_status — the exact
 * transition an admin picking a status from the dropdown would make, just
 * triggered by what the partner reported rather than a human's judgment. An
 * unmapped status parks the application (modules/visa/partner/sync.ts)
 * instead of guessing.
 */
export async function adminSyncPartnerStatus(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
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
  await supabase
    .from("visa_applications")
    .update({ partner_status: result.status, partner_raw_payload: rawPayload, partner_last_synced_at: new Date().toISOString() })
    .eq("id", applicationId);
  await supabase
    .from("visa_processing_jobs")
    .update({ partner_status: result.status, partner_raw_payload: rawPayload, partner_last_synced_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("status", "active")
    .eq("route", "partner");

  if (result.status !== application.partner_status) {
    const mapped = await mapPartnerStatus(application.partner_provider_key, result.status);
    if (mapped.type === "mapped") {
      const { error: transitionError } = await supabase.rpc("set_visa_application_status", {
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
