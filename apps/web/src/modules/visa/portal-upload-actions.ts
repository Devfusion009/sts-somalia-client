"use server";

import { missingTravellerDocuments, documentMemberId } from "./schemas";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const metadata = z.object({
  applicationId: z.string().uuid(), targetId: z.string().uuid(), kind: z.enum(["request", "replace", "missing"]), slotKey: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(255), size: z.number().int().positive().max(5 * 1024 * 1024),
  type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
});
export type PortalUploadInput = z.infer<typeof metadata>;

async function checkTarget(input: PortalUploadInput) {
  const user = await requireUser(`/account/visa/${input.applicationId}`);
  const client = await createClient();
  const { data: app } = await client.from("visa_applications").select("submitted_by,status,resolved_documents,visa_type:visa_type_id(required_documents),members:visa_members(id,full_name,is_primary),documents:visa_documents(document_type,member_id,is_current,review_status)").eq("id", input.applicationId).maybeSingle();
  if (!app || app.submitted_by !== user.id || ["draft", "approved", "rejected", "issued", "cancelled"].includes(app.status)) return { error: "This application is not available for uploads." };
  if (input.kind === "request") {
    const { data } = await client.from("visa_document_requests").select("status").eq("id", input.targetId).eq("application_id", input.applicationId).maybeSingle();
    if (data?.status !== "requested") return { error: "This document request is no longer awaiting an upload." };
  } else if (input.kind === "missing") {
    const slot = missingTravellerDocuments(app).find(slot => slot.memberId === input.targetId && slot.key === input.slotKey);
    if (!slot || app.documents.some(doc => doc.is_current && doc.document_type === input.slotKey && documentMemberId(app, doc) === input.targetId)) return { error: "This traveller no longer needs this document. Refresh the application." };
    if (input.size > (slot.max_mb ?? 5) * 1024 * 1024) return { error: `This file must be ${slot.max_mb ?? 5}MB or smaller.` };
  } else {
    const { data } = await client.from("visa_documents").select("review_status,is_current").eq("id", input.targetId).eq("application_id", input.applicationId).maybeSingle();
    if (!data?.is_current || data.review_status !== "rejected") return { error: "This document no longer needs replacement." };
  }
  return { client, error: null };
}

export async function preparePortalUpload(raw: PortalUploadInput) {
  const parsed = metadata.safeParse(raw);
  if (!parsed.success) return { error: "Choose a JPG, PNG or PDF file, up to 5MB." };
  const target = await checkTarget(parsed.data);
  if (!target.client) return { error: target.error };
  const path = `${raw.applicationId}/${raw.kind}-${raw.targetId}-${randomUUID()}`;
  const { data, error } = await target.client.storage.from("visa-documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "Upload could not be started. Please try again." };
  return { error: null, path, url: data.signedUrl };
}

export async function completePortalUpload(raw: PortalUploadInput, path: string) {
  const parsed = metadata.safeParse(raw);
  if (!parsed.success) return { error: "Invalid upload." };
  const prefix = `${raw.applicationId}/${raw.kind}-${raw.targetId}-`;
  if (!path.startsWith(prefix) || !z.string().uuid().safeParse(path.slice(prefix.length)).success) return { error: "Invalid upload path." };
  const target = await checkTarget(parsed.data);
  if (!target.client) return { error: target.error };
  const { data: file, error: infoError } = await target.client.storage.from("visa-documents").info(path);
  if (infoError || !file || Number(file.size ?? file.metadata?.size) !== raw.size || (file.contentType ?? file.metadata?.mimetype) !== raw.type) return { error: "The uploaded file could not be verified. Choose the file again." };
  const common = { p_storage_path: path, p_file_name: raw.name, p_file_size: raw.size, p_content_type: raw.type };
  const result = raw.kind === "request"
    ? await target.client.rpc("visa_fulfil_document_request", { p_request_id: raw.targetId, ...common })
    : raw.kind === "missing"
      ? await target.client.rpc("visa_upload_missing_document", { p_application_id: raw.applicationId, p_member_id: raw.targetId, p_document_type: raw.slotKey!, ...common })
      : await target.client.rpc("visa_replace_document", { p_document_id: raw.targetId, ...common });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/account/visa/${raw.applicationId}`);
  revalidatePath(`/admin/visa/${raw.applicationId}`);
  revalidatePath("/admin/visa");
  return { error: null };
}
