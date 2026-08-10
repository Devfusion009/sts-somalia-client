import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { Database } from "@/lib/types/database.types";

export type TravelerProfile = Database["public"]["Tables"]["traveler_profiles"]["Row"];
export type TravelerDocument = Database["public"]["Tables"]["traveler_documents"]["Row"];

/**
 * Every traveler saved by the signed-in user, self first.
 *
 * RLS scopes this to the owner, so no explicit owner filter is needed — but one
 * is applied anyway. Relying on RLS alone means a future policy change silently
 * widens this query; the redundant predicate costs nothing and keeps the
 * intent readable at the call site.
 */
export async function getMyTravelers(): Promise<TravelerProfile[]> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("owner_id", profile.id)
    .order("is_self", { ascending: false })
    .order("full_name");

  return data ?? [];
}

/** The account holder's own traveler record, or null if they haven't filled it in. */
export async function getSelfTraveler(): Promise<TravelerProfile | null> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("traveler_profiles")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("is_self", true)
    .maybeSingle();

  return data ?? null;
}

export type VaultDocument = TravelerDocument & {
  traveler: { id: string; full_name: string; is_self: boolean } | null;
};

/** Vault contents with the owning traveler joined in for grouping/labelling. */
export async function getMyDocuments(): Promise<VaultDocument[]> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("traveler_documents")
    .select("*, traveler:traveler_profiles(id, full_name, is_self)")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as VaultDocument[];
}

/**
 * A short-lived download URL for one vault object.
 *
 * The bucket is private, so the storage path alone is not viewable. Ten
 * minutes is enough to click through to a download and short enough that a URL
 * pasted into a chat is dead before it travels far.
 */
export async function getDocumentDownloadUrl(documentId: string): Promise<string | null> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("traveler_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!doc) return null;

  const { data } = await supabase.storage
    .from("traveler-documents")
    .createSignedUrl(doc.storage_path, 600);

  return data?.signedUrl ?? null;
}
