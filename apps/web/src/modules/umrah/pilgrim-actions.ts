"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type PilgrimActionState = { error: string | null } | null;

const BUCKET = "umrah-documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const optional = (max: number) => z.string().trim().max(max);
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.");

const pilgrimPatchSchema = z.object({
  pilgrimId: z.string().uuid(),
  full_name: z.string().trim().min(2, "Enter the pilgrim's full name.").max(120),
  gender: z.enum(["male", "female"], { message: "Choose a gender." }),
  date_of_birth: optionalDate,
  nationality: optional(60),
  passport_number: optional(20),
  passport_expiry: optionalDate,
  passport_issue_country: optional(60),
  mahram_name: optional(120),
  mahram_relation: optional(60),
  phone: optional(30),
});

function revalidateAll() {
  revalidatePath("/account/bookings", "layout");
  revalidatePath("/agent/bookings", "layout");
  revalidatePath("/admin/umrah/bookings", "layout");
  revalidatePath("/admin/umrah/departures", "layout");
}

/** Maps update_umrah_pilgrim's raise messages to one plain line. */
function pilgrimErrorMessage(message: string) {
  if (message.includes("locked")) return "Pilgrim details are locked while visas are processed.";
  if (message.includes("not found")) return "Pilgrim not found.";
  if (message.includes("full name")) return "Enter the pilgrim's full name.";
  if (message.includes("gender")) return "Choose a gender.";
  return "Could not update the pilgrim.";
}

/**
 * Edits one pilgrim through update_umrah_pilgrim, which decides who may edit
 * and when. Shared by the customer, agent and admin booking pages; it never
 * redirects, so it is safe from the agent desk.
 */
export async function updateUmrahPilgrim(
  _prev: PilgrimActionState,
  formData: FormData
): Promise<PilgrimActionState> {
  await requireUser();
  const text = (key: string) => String(formData.get(key) ?? "");
  const parsed = pilgrimPatchSchema.safeParse({
    pilgrimId: formData.get("pilgrimId"),
    full_name: text("full_name"),
    gender: formData.get("gender"),
    date_of_birth: text("date_of_birth"),
    nationality: text("nationality"),
    passport_number: text("passport_number"),
    passport_expiry: text("passport_expiry"),
    passport_issue_country: text("passport_issue_country"),
    mahram_name: text("mahram_name"),
    mahram_relation: text("mahram_relation"),
    phone: text("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { pilgrimId, ...patch } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_umrah_pilgrim", {
    p_pilgrim_id: pilgrimId,
    p_patch: patch,
  });
  if (error) return { error: pilgrimErrorMessage(error.message) };

  revalidateAll();
  return { error: null };
}

const handInTypeSchema = z.enum(["passport_copy", "photo", "vaccination", "national_id"]);

/**
 * A traveller (or their agent) hands in a passport copy, photo or
 * certificate for one pilgrim. Files land under {booking}/customer/... —
 * the storage policy only lets them write there, never over staff files —
 * and wait for staff review.
 */
export async function uploadPilgrimDocument(
  _prev: PilgrimActionState,
  formData: FormData
): Promise<PilgrimActionState> {
  const profile = await requireUser();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const pilgrimId = z.string().uuid().safeParse(formData.get("pilgrimId"));
  if (!bookingId.success || !pilgrimId.success) return { error: "Choose a pilgrim." };
  const docType = handInTypeSchema.safeParse(formData.get("docType"));
  if (!docType.success) return { error: "Choose a document type." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "Files must be 10MB or smaller." };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Upload a PDF, JPG, PNG or WebP file." };

  const supabase = await createClient();
  const { data: pilgrim } = await supabase
    .from("umrah_pilgrims")
    .select("id, full_name")
    .eq("id", pilgrimId.data)
    .eq("booking_id", bookingId.data)
    .maybeSingle();
  if (!pilgrim) return { error: "Pilgrim not found on this booking." };

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${bookingId.data}/customer/${pilgrimId.data}/${docType.data}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: "Uploads are closed for this booking." };

  const labels: Record<z.infer<typeof handInTypeSchema>, string> = {
    passport_copy: "Passport copy",
    photo: "Photo",
    vaccination: "Vaccination certificate",
    national_id: "National ID",
  };

  const { error } = await supabase.from("umrah_booking_documents").insert({
    booking_id: bookingId.data,
    pilgrim_id: pilgrimId.data,
    doc_type: docType.data,
    title: `${labels[docType.data]} — ${pilgrim.full_name}`.slice(0, 120),
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
    uploaded_by: profile.id,
    source: "customer",
    review_status: "pending",
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: "Uploads are closed for this booking." };
  }

  revalidateAll();
  return { error: null };
}

export async function deletePilgrimDocument(
  _prev: PilgrimActionState,
  formData: FormData
): Promise<PilgrimActionState> {
  await requireUser();
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return { error: "Invalid document." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("umrah_booking_documents")
    .delete()
    .eq("id", documentId.data)
    .eq("source", "customer")
    .eq("review_status", "pending")
    .select("storage_path")
    .maybeSingle();
  if (!doc) return { error: "This document can no longer be removed." };

  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  revalidateAll();
  return { error: null };
}
