"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { travelerSchema, TRAVELER_DOCUMENT_TYPES } from "./schemas";

const documentTypeSchema = z.enum(
  TRAVELER_DOCUMENT_TYPES.map((t) => t.value) as [string, ...string[]]
);

/**
 * Vault upload limits.
 *
 * 10 MB comfortably covers a phone photo of a passport page or a multi-page
 * PDF bank statement, and is well under the 50 MB Supabase Storage default so
 * a rejection surfaces here as a readable message rather than a truncated
 * upload at the edge.
 */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

function readTravelerForm(formData: FormData) {
  return travelerSchema.safeParse({
    fullName: formData.get("fullName"),
    relationship: formData.get("relationship") ?? "self",
    dateOfBirth: formData.get("dateOfBirth") ?? undefined,
    gender: formData.get("gender") ?? undefined,
    nationality: formData.get("nationality") ?? undefined,
    passportNumber: formData.get("passportNumber") ?? undefined,
    passportIssueDate: formData.get("passportIssueDate") ?? undefined,
    passportExpiry: formData.get("passportExpiry") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
}

function toRow(input: z.infer<typeof travelerSchema>) {
  return {
    full_name: input.fullName,
    relationship: input.relationship,
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    nationality: input.nationality,
    passport_number: input.passportNumber,
    passport_issue_date: input.passportIssueDate,
    passport_expiry: input.passportExpiry,
    notes: input.notes,
  };
}

/**
 * Saves the account holder's own traveler record from the Profile card.
 *
 * Update-then-insert rather than upsert. PostgREST's `onConflict` emits
 * `ON CONFLICT (owner_id)`, which Postgres cannot match to
 * traveler_profiles_one_self_per_owner because that index is PARTIAL
 * (`where is_self`) — inferring a partial index requires repeating its
 * predicate, which PostgREST has no way to express. So: try the update, and
 * fall back to an insert when it matched nothing.
 *
 * The 23505 branch closes the race between those two statements — a second
 * concurrent save inserts first, this one's insert trips the unique index, and
 * we retry as the update it should have been.
 */
export async function saveSelfTravelerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = readTravelerForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const row = { ...toRow(parsed.data), relationship: "self" as const };

  const { data: updated, error: updateError } = await supabase
    .from("traveler_profiles")
    .update(row)
    .eq("owner_id", profile.id)
    .eq("is_self", true)
    .select("id");

  if (updateError) return { error: updateError.message };

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from("traveler_profiles")
      .insert({ owner_id: profile.id, is_self: true, ...row });

    if (insertError) {
      if (insertError.code !== "23505") return { error: insertError.message };

      const { error: retryError } = await supabase
        .from("traveler_profiles")
        .update(row)
        .eq("owner_id", profile.id)
        .eq("is_self", true);
      if (retryError) return { error: retryError.message };
    }
  }

  revalidatePath("/account");
  revalidatePath("/account/travelers");
  return { error: null };
}

/** Creates or updates a saved companion. A blank travelerId means "create". */
export async function saveTravelerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = readTravelerForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const travelerId = formData.get("travelerId")?.toString().trim() || null;
  const supabase = await createClient();

  if (travelerId) {
    // owner_id is in the predicate as well as the RLS policy so a mismatched
    // id fails as "not found" rather than silently updating nothing.
    const { error } = await supabase
      .from("traveler_profiles")
      .update(toRow(parsed.data))
      .eq("id", travelerId)
      .eq("owner_id", profile.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("traveler_profiles").insert({
      owner_id: profile.id,
      is_self: false,
      ...toRow(parsed.data),
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/account/travelers");
  return { error: null };
}

export async function deleteTravelerAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const travelerId = z.string().uuid().safeParse(formData.get("travelerId"));
  if (!travelerId.success) return;

  const supabase = await createClient();
  // is_self is excluded so the Profile card's own record can never be removed
  // by a stray form post — it is edited, never deleted.
  await supabase
    .from("traveler_profiles")
    .delete()
    .eq("id", travelerId.data)
    .eq("owner_id", profile.id)
    .eq("is_self", false);

  revalidatePath("/account/travelers");
}

/**
 * Uploads one file into the private vault.
 *
 * The DB row is written only after the object lands in storage, and the object
 * is removed again if the row insert fails — otherwise a failed insert leaves
 * an orphan file that nothing references and nobody can delete through the UI.
 */
export async function uploadVaultDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is larger than 10 MB. Try a smaller scan or photo." };
  }
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return { error: "Upload a JPG, PNG, WebP, HEIC, or PDF file." };
  }

  // Validated against the enum rather than cast: an unrecognised value would
  // otherwise reach Postgres and fail as an opaque enum error.
  const documentType = documentTypeSchema.safeParse(formData.get("documentType") ?? "other");
  if (!documentType.success) return { error: "Choose a document type." };

  const label = formData.get("label")?.toString().trim() || null;
  const travelerId = formData.get("travelerId")?.toString().trim() || null;
  const expiresAt = formData.get("expiresAt")?.toString().trim() || null;

  const supabase = await createClient();

  // The path prefix IS the authorization boundary — the storage policies match
  // on (storage.foldername(name))[1] = auth.uid(). Derived from the session,
  // never from the form.
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const objectId = crypto.randomUUID();
  const storagePath = `${profile.id}/${objectId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("traveler-documents")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("traveler_documents").insert({
    owner_id: profile.id,
    traveler_id: travelerId,
    document_type: documentType.data as never,
    label,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
    expires_at: expiresAt,
  });

  if (insertError) {
    await supabase.storage.from("traveler-documents").remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath("/account/documents");
  return { error: null };
}

/** Removes a vault document, storage object first so no unreferenced file is left behind. */
export async function deleteVaultDocumentAction(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("traveler_documents")
    .select("id, storage_path")
    .eq("id", documentId.data)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!doc) return;

  await supabase.storage.from("traveler-documents").remove([doc.storage_path]);
  await supabase.from("traveler_documents").delete().eq("id", doc.id).eq("owner_id", profile.id);

  revalidatePath("/account/documents");
}
