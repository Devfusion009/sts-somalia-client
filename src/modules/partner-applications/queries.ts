import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG, type ApplicationKind } from "./config";

export type DocumentRef = {
  key: string;
  label: string;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
};

/**
 * The three application tables differ only in their name column; every other
 * field this module touches (id, business_details, document_refs, status,
 * ...) is shared. Since `kind` picks the table at runtime, TS can't narrow
 * the `.from(cfg.table)` union — this shape is the common contract callers
 * rely on, applied via a single cast at the query boundary.
 */
export type ApplicationRow = {
  id: string;
  status: string;
  business_details: Record<string, unknown>;
  document_refs: DocumentRef[];
  reference_number: string | null;
  review_notes: string | null;
  internal_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

/** Editable up to a final decision — draft/more_info_requested (never submitted or kicked back) or pending/under_review (submitted, but not yet approved/rejected). */
const EDITABLE_STATUSES = ["draft", "more_info_requested", "pending", "under_review"] as const;

/** RLS-scoped fetch that also proves "mine + still editable" (not yet approved/rejected). */
export async function getEditableApplication(kind: ApplicationKind, id: string, userId: string) {
  const supabase = await createClient();
  const cfg = APP_CONFIG[kind];
  const { data } = await supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .eq("applicant_id", userId)
    .in("status", EDITABLE_STATUSES)
    .maybeSingle();
  return { supabase, application: data as unknown as ApplicationRow | null };
}

/** Read-only fetch for the applicant's own application regardless of status — for the "view" page. */
export async function getOwnedApplication(kind: ApplicationKind, id: string, userId: string): Promise<ApplicationRow | null> {
  const supabase = await createClient();
  const cfg = APP_CONFIG[kind];
  const { data } = await supabase.from(cfg.table).select("*").eq("id", id).eq("applicant_id", userId).maybeSingle();
  return data as unknown as ApplicationRow | null;
}

/** The applicant's most recent application of this type, for the become-a-partner status page. */
export async function getLatestApplication(kind: ApplicationKind, userId: string) {
  const supabase = await createClient();
  const cfg = APP_CONFIG[kind];
  const { data } = await supabase
    .from(cfg.table)
    .select("id, status, reference_number, review_notes, reviewed_at, submitted_at, created_at")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export type RecentApplication = {
  kind: ApplicationKind;
  id: string;
  status: string;
  reference_number: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  name: string | null;
};

const KINDS: ApplicationKind[] = ["agency", "hotel_partner", "affiliate", "venue_partner"];

/** Full application history across all three programs, newest first — for the "Recent applications" list. */
export async function getRecentApplications(userId: string, limit = 10): Promise<RecentApplication[]> {
  const supabase = await createClient();

  const rows = await Promise.all(
    KINDS.map(async (kind) => {
      const cfg = APP_CONFIG[kind];
      const nameSelect = cfg.nameField ? `, ${cfg.nameField}` : "";
      const { data } = await supabase
        .from(cfg.table)
        .select(`id, status, reference_number, review_notes, reviewed_at, submitted_at, created_at${nameSelect}`)
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
        (row): RecentApplication => ({
          kind,
          id: row.id as string,
          status: row.status as string,
          reference_number: row.reference_number as string | null,
          review_notes: row.review_notes as string | null,
          reviewed_at: row.reviewed_at as string | null,
          submitted_at: row.submitted_at as string | null,
          created_at: row.created_at as string,
          name: cfg.nameField ? ((row[cfg.nameField] as string | null) ?? null) : null,
        })
      );
    })
  );

  return rows
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export function wizardStep(businessDetails: unknown): number {
  if (businessDetails && typeof businessDetails === "object" && "_wizard_step" in businessDetails) {
    const v = (businessDetails as Record<string, unknown>)._wizard_step;
    if (typeof v === "number" && v >= 1) return v;
  }
  return 1;
}

export function documentRefs(value: unknown): DocumentRef[] {
  if (!Array.isArray(value)) return [];
  return value as DocumentRef[];
}
