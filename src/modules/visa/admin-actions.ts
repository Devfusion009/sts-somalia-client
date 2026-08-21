"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getApplicationDetail } from "./queries";
import { submitToPartner, syncPartnerStatus } from "./partner/registry";
import type { Json } from "@/lib/types/database.types";

export type ActionState = { error: string | null } | null;

const DECISION_STATUSES = [
  "submitted",
  "in_review",
  "additional_info_required",
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

  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const isDecision = ["approved", "rejected", "issued"].includes(parsed.data.status);
  const { error } = await supabase
    .from("visa_applications")
    .update({
      status: parsed.data.status,
      ...(isDecision ? { decided_by: admin.id, decided_at: new Date().toISOString() } : {}),
    })
    .eq("id", parsed.data.applicationId);
  if (error) return { error: error.message };

  // The status trigger has just written the history row; attach the note to it.
  if (parsed.data.note) {
    const service = createAdminClient();
    const { data: latest } = await service
      .from("visa_application_status_history")
      .select("id")
      .eq("application_id", parsed.data.applicationId)
      .eq("status", parsed.data.status)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      await service
        .from("visa_application_status_history")
        .update({ note: parsed.data.note })
        .eq("id", latest.id);
    }
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

  await supabase
    .from("visa_applications")
    .update({ status: "additional_info_required" })
    .eq("id", parsed.data.applicationId)
    .neq("status", "additional_info_required");

  revalidateVisaViews(parsed.data.applicationId);
  return { error: null };
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
  if ((outstanding ?? []).length === 0) {
    await supabase
      .from("visa_applications")
      .update({ status: "processing" })
      .eq("id", parsed.applicationId)
      .eq("status", "additional_info_required");
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
    verified: true,
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
export async function adminSubmitToPartner(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const applicationId = z.string().uuid().safeParse(formData.get("applicationId"));
  if (!applicationId.success) return { error: "Invalid application." };

  await requirePlatformAdmin();
  const application = await getApplicationDetail(applicationId.data);
  if (!application) return { error: "Application not found." };
  if (application.visa_type?.processing_mode !== "partner" || !application.visa_type.partner_provider_key) {
    return { error: "This visa type isn't configured for partner processing." };
  }

  const result = await submitToPartner(application.visa_type.partner_provider_key, { application });
  if (result.type === "error") return { error: result.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("visa_applications")
    .update({
      partner_provider_key: application.visa_type.partner_provider_key,
      partner_ref: result.partnerRef,
      partner_status: result.status ?? null,
      partner_last_synced_at: new Date().toISOString(),
    })
    .eq("id", applicationId.data);
  if (error) return { error: error.message };

  revalidateVisaViews(applicationId.data);
  return { error: null };
}

/** Pulls the latest status from the partner, when the adapter supports it. */
export async function adminSyncPartnerStatus(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("visa_applications")
    .select("partner_provider_key, partner_ref")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application?.partner_provider_key || !application.partner_ref) return;

  const result = await syncPartnerStatus(application.partner_provider_key, application.partner_ref);
  if (result.type === "status") {
    await supabase
      .from("visa_applications")
      .update({
        partner_status: result.status,
        partner_raw_payload: result.raw ? (JSON.parse(JSON.stringify(result.raw)) as Json) : null,
        partner_last_synced_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
  }

  revalidateVisaViews(applicationId);
}
