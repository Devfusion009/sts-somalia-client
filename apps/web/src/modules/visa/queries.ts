import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { cachedRead } from "@/lib/redis";
import { matchesDestination } from "./search";

// The public visa catalog is the same for every visitor, so it is cached in
// Redis (tag "visa", cleared by the admin visa and nationality-rule actions)
// and read with the signed-out client. The country filter runs after the
// read so one cached list serves every search.
const CATALOG_TTL_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getVisaTypes(filters: { country?: string; category?: string } = {}) {
  const visaTypes = await cachedRead(
    `visa:list:${filters.category ?? "all"}`,
    CATALOG_TTL_SECONDS,
    async () => {
      let query = createAnonClient()
        .from("visa_types")
        .select("*")
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("name");
      if (filters.category) query = query.eq("visa_category", filters.category);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { tags: ["visa"] }
  ).catch(() => []);
  if (!filters.country) return visaTypes;

  return visaTypes.filter((v) => matchesDestination(v.destination_country_code, filters.country!));
}

export async function getVisaTypeById(id: string) {
  if (!UUID.test(id)) return null;
  return cachedRead(
    `visa:type:${id}`,
    CATALOG_TTL_SECONDS,
    async () => {
      const { data, error } = await createAnonClient()
        .from("visa_types")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // An unknown or unpublished id is not stored: ids a visitor invents must not fill the cache.
    { tags: ["visa"], cacheIf: (value) => value !== null }
  ).catch(() => null);
}

/**
 * What this visa type actually costs and requires for one nationality —
 * read-only preview for the browse/detail pages, before any application
 * exists to stamp a snapshot onto. Same function the wizard uses to freeze
 * that snapshot once nationality is confirmed (see savePersonalInfo), so a
 * quoted price here can never disagree with what the wizard later resolves.
 */
export async function getResolvedVisaPricing(visaTypeId: string, nationalityCode: string) {
  const nationality = nationalityCode.trim().toUpperCase();
  if (!UUID.test(visaTypeId) || !/^[A-Z]{2}$/.test(nationality)) return null;
  return cachedRead(
    `visa:price:${visaTypeId}:${nationality}`,
    CATALOG_TTL_SECONDS,
    async () => {
      const { data, error } = await createAnonClient().rpc("resolve_visa_pricing", {
        p_visa_type_id: visaTypeId,
        p_nationality_code: nationality,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    { tags: ["visa"], cacheIf: (value) => value !== null }
  ).catch(() => null);
}

/** The signed-in user's applications (any status), most recently submitted (or created draft) first. */
export async function getMyVisaApplications() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visa_applications")
    .select(
      `*,
       visa_type:visa_type_id (name, destination_country_code),
       documents:visa_documents (id, document_type, is_current, review_status, rejection_reason),
       document_requests:visa_document_requests (id, title, status, requirement, due_date, description),
       appointments:visa_appointments (id, status, appointment_type, scheduled_at, confirmation_number, biometrics_required,
         centre:visa_application_centres (name, city, address, timezone, collection_hours)),
       passports:visa_passports (id, status, holder_name, tracking_reference),
       order_items (order:order_id (id, status, total, currency))`
    )
    .order("created_at", { ascending: false });
  // A failed read must not render as "No visa applications yet".
  if (error) throw error;
  // Match the booking date shown in the list. Resuming an older draft must
  // place its new submission ahead of applications created more recently.
  return (data ?? []).sort((a, b) =>
    (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id)
  );
}

/**
 * Count of the current user's applications waiting on a document from them —
 * the source for the "Visa Applications" nav badge. Reads straight from
 * Postgres (RLS-scoped), not through the notifications table, so a customer
 * still sees it if the notification never arrived or was already dismissed.
 */
export async function getMyVisaActionRequiredCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("visa_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "additional_info_required");
  return count ?? 0;
}

/** Existing draft for this visa type by the current user, if any (resume). */
export async function getMyDraftForVisaType(visaTypeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select("id")
    .eq("visa_type_id", visaTypeId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Everything the wizard needs; RLS scopes access to the owner/agency/admin. */
export async function getApplicationForWizard(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select(
      `*,
       visa_type:visa_type_id (*),
       members:visa_members (*),
       documents:visa_documents (*)`
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return null;
  data.members.sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  return data;
}

/** Tracking/result view: adds status history and document requests. */
export async function getApplicationDetail(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select(
      `*,
       visa_type:visa_type_id (*),
       members:visa_members (*),
       documents:visa_documents (*),
       history:visa_application_status_history (*),
       document_requests:visa_document_requests (*),
       appointments:visa_appointments (*, centre:visa_application_centres (name, city, address, timezone, collection_hours, phone)),
       passports:visa_passports (*),
       decisions:visa_decisions (*),
       events:visa_case_events (id, event_type, customer_summary, created_at),
       messages:visa_case_messages (*)`
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return null;
  data.members.sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  data.history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  data.document_requests.sort((a, b) => a.created_at.localeCompare(b.created_at));
  data.appointments.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  data.events.sort((a, b) => b.created_at.localeCompare(a.created_at));
  data.messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return data;
}

export type WizardApplication = NonNullable<Awaited<ReturnType<typeof getApplicationForWizard>>>;
export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;

/** The order (if any) whose single item is this visa application. */
export async function getOrderForVisaApplication(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select(
      "order_id, order:order_id (id, status, subtotal, markup_amount, fee_total, total, currency, order_number, payments(status, amount, method_label))"
    )
    .eq("visa_application_id", applicationId)
    .maybeSingle();
  const order = data?.order ?? null;
  if (!order) return null;

  const succeeded = order.payments.filter((p) => p.status === "succeeded");
  const paid = succeeded.reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    ...order,
    paid,
    remaining: Number(order.total) - paid,
    method: succeeded.at(-1)?.method_label ?? null,
  };
}

/** Available re-application credit for this application's applicant (refused visa, STS fee). */
export async function getReapplyCredit(app: {
  currency: string;
  agency_customer_id: string | null;
  applicant_profile_id: string | null;
  submitted_by: string;
}): Promise<{ amount: number; currency: string } | null> {
  const supabase = await createClient();
  let query = supabase
    .from("visa_reapply_credits")
    .select("amount, currency")
    .eq("status", "available")
    .eq("currency", app.currency)
    .gt("expires_at", new Date().toISOString())
    .order("created_at")
    .limit(1);
  query = app.agency_customer_id
    ? query.eq("agency_customer_id", app.agency_customer_id)
    : query.is("agency_customer_id", null).eq("profile_id", app.applicant_profile_id ?? app.submitted_by);
  const { data } = await query.maybeSingle();
  return data ? { amount: Number(data.amount), currency: data.currency } : null;
}
