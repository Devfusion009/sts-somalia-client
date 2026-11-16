import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { Database, TravelerInput, SaveTravelerInput, TravelerProfile, VaultDocument } from "@sts/shared-types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

function toRow(input: TravelerInput) {
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
 * Direct port of apps/web's modules/travelers/{queries,actions}.ts. Plain
 * @Injectable(), request-scoped via RlsSupabaseService — same pattern as
 * every prior phase's service.
 */
@Injectable()
export class TravelersService {
  constructor(private readonly rls: RlsSupabaseService) {}

  /** Cast locally, not globally on RlsSupabaseService — see the comment on that class. */
  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  async getMyTravelers(userId: string): Promise<TravelerProfile[]> {
    const { data, error } = await this.db()
      .from("traveler_profiles")
      .select("*")
      .eq("owner_id", userId)
      .order("is_self", { ascending: false })
      .order("full_name");
    if (error) throw new Error("Travelers could not be loaded.");
    return data ?? [];
  }

  async getSelfTraveler(userId: string): Promise<TravelerProfile | null> {
    const { data, error } = await this.db()
      .from("traveler_profiles")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_self", true)
      .maybeSingle();
    if (error) throw new Error("Travel details could not be loaded.");
    return data ?? null;
  }

  async getMyDocuments(userId: string): Promise<VaultDocument[]> {
    const { data, error } = await this.db()
      .from("traveler_documents")
      .select("*, traveler:traveler_profiles(id, full_name, is_self)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Documents could not be loaded.");
    return (data ?? []) as VaultDocument[];
  }

  /** Ten minutes: enough to click through to a download, short enough a pasted link is dead fast. */
  async getDocumentDownloadUrl(userId: string, documentId: string): Promise<string | null> {
    const supabase = this.db();
    const { data: doc } = await supabase
      .from("traveler_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!doc) return null;

    const { data } = await supabase.storage.from("traveler-documents").createSignedUrl(doc.storage_path, 600);
    return data?.signedUrl ?? null;
  }

  /**
   * Update-then-insert rather than upsert: PostgREST's onConflict can't
   * express traveler_profiles_one_self_per_owner's partial-index predicate
   * (where is_self). The 23505 branch closes the race between the two
   * statements. Direct port, unchanged logic.
   */
  async saveSelfTraveler(userId: string, input: TravelerInput) {
    const supabase = this.db();
    const row = { ...toRow(input), relationship: "self" as const };

    const { data: updated, error: updateError } = await supabase
      .from("traveler_profiles")
      .update(row)
      .eq("owner_id", userId)
      .eq("is_self", true)
      .select("id");
    if (updateError) throw new Error(updateError.message);

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("traveler_profiles")
        .insert({ owner_id: userId, is_self: true, ...row });

      if (insertError) {
        if (insertError.code !== "23505") throw new Error(insertError.message);
        const { error: retryError } = await supabase
          .from("traveler_profiles")
          .update(row)
          .eq("owner_id", userId)
          .eq("is_self", true);
        if (retryError) throw new Error(retryError.message);
      }
    }
    return { ok: true as const };
  }

  async saveTraveler(userId: string, input: SaveTravelerInput) {
    const supabase = this.db();
    const { travelerId, ...rest } = input;

    if (travelerId) {
      const { error } = await supabase
        .from("traveler_profiles")
        .update(toRow(rest))
        .eq("id", travelerId)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("traveler_profiles")
        .insert({ owner_id: userId, is_self: false, ...toRow(rest) });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  }

  /** is_self excluded so the Profile card's own record can never be removed by a stray call. */
  async deleteTraveler(userId: string, travelerId: string) {
    await this.db()
      .from("traveler_profiles")
      .delete()
      .eq("id", travelerId)
      .eq("owner_id", userId)
      .eq("is_self", false);
    return { ok: true as const };
  }

  /**
   * The DB row is written only after the object lands in storage, and the
   * object is removed again if the row insert fails — otherwise a failed
   * insert leaves an orphan file nothing references. Called from
   * travelers.controller.ts (multipart REST, not tRPC — binary doesn't
   * carry well over tRPC).
   */
  async uploadVaultDocument(
    userId: string,
    file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    fields: { documentType: string; label?: string; travelerId?: string; expiresAt?: string }
  ) {
    if (file.size === 0) throw new BadRequestException("Choose a file to upload.");
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException("That file is larger than 10 MB. Try a smaller scan or photo.");
    }
    if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Upload a JPG, PNG, WebP, HEIC, or PDF file.");
    }

    const supabase = this.db();
    const extension = file.originalname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const objectId = crypto.randomUUID();
    const storagePath = `${userId}/${objectId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("traveler-documents")
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await supabase.from("traveler_documents").insert({
      owner_id: userId,
      traveler_id: fields.travelerId || null,
      document_type: fields.documentType as never,
      label: fields.label || null,
      storage_path: storagePath,
      file_name: file.originalname,
      file_size: file.size,
      content_type: file.mimetype,
      expires_at: fields.expiresAt || null,
    });

    if (insertError) {
      await supabase.storage.from("traveler-documents").remove([storagePath]);
      throw new Error(insertError.message);
    }
    return { ok: true as const };
  }

  async deleteVaultDocument(userId: string, documentId: string) {
    const supabase = this.db();
    const { data: doc } = await supabase
      .from("traveler_documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!doc) throw new NotFoundException("Document not found.");

    await supabase.storage.from("traveler-documents").remove([doc.storage_path]);
    await supabase.from("traveler_documents").delete().eq("id", doc.id).eq("owner_id", userId);
    return { ok: true as const };
  }
}
