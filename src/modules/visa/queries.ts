import "server-only";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/countries";

export async function getVisaTypes(filters: { country?: string; category?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("visa_types")
    .select("*")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("name");
  if (filters.category) query = query.eq("visa_category", filters.category);

  const { data } = await query;
  const visaTypes = data ?? [];
  if (!filters.country) return visaTypes;

  const needle = filters.country.trim().toLowerCase();
  return visaTypes.filter(
    (v) =>
      v.destination_country_code.toLowerCase().includes(needle) ||
      countryName(v.destination_country_code).toLowerCase().includes(needle)
  );
}

export async function getVisaTypeById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_types")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

/** The signed-in user's applications (any status), newest first. */
export async function getMyVisaApplications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_applications")
    .select("*, visa_type:visa_type_id (name, destination_country_code)")
    .order("created_at", { ascending: false });
  return data ?? [];
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
       document_requests:visa_document_requests (*)`
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return null;
  data.members.sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  data.history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  data.document_requests.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return data;
}

export type WizardApplication = NonNullable<Awaited<ReturnType<typeof getApplicationForWizard>>>;
export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;

/** The order (if any) whose single item is this visa application. */
export async function getOrderForVisaApplication(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("order_id, order:order_id (id, status, total, currency, order_number)")
    .eq("visa_application_id", applicationId)
    .maybeSingle();
  return data?.order ?? null;
}
