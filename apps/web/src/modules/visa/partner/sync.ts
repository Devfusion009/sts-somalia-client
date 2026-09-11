import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database.types";

/**
 * A processing note plus one notification per platform admin — the shared
 * shape behind both "the vendor sent a status we don't recognize" and "the
 * vendor sent a status we do recognize, but applying it was refused" (an
 * illegal transition, or a business rule like the payment gate). Either way
 * the applicant hears nothing (no decision was actually made) and staff
 * hear about it once.
 */
async function parkForPartnerEvent(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  applicationRef: string,
  type: string,
  title: string,
  note: string,
  data: Record<string, unknown>
) {
  await supabase.from("visa_processing_notes").insert({ application_id: applicationId, note });

  const { data: admins } = await supabase.from("profiles").select("id").eq("is_platform_admin", true);
  if (admins && admins.length > 0) {
    await supabase.from("notifications").insert(
      admins.map((admin) => ({
        profile_id: admin.id,
        type,
        title,
        body: `${applicationRef}: ${note}`,
        data: data as Json,
      }))
    );
  }
}

/** A vendor status neither the admin's manual pull nor the webhook's push can make sense of. */
export async function parkForUnmappedPartnerStatus(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  applicationRef: string,
  providerKey: string,
  vendorStatus: string
) {
  await parkForPartnerEvent(
    supabase,
    applicationId,
    applicationRef,
    "visa_partner_status_unmapped",
    "Unrecognized partner status",
    `${providerKey} returned an unrecognized status "${vendorStatus}" — needs manual review.`,
    { applicationId, applicationRef, providerKey, vendorStatus }
  );
}

/**
 * A vendor status mapped to a real visa_status, but applying it was refused
 * — e.g. the M5 payment gate blocking submitted → in_review on an unpaid
 * order, or any other rule the state machine enforces. Without this, that
 * refusal (found live: a webhook correctly extracted a custom field-name
 * payload and mapped its status, then the transition RPC failed and nobody
 * was told) is invisible — the vendor's own status field still updates, so
 * only the missing decision reveals anything went wrong.
 */
export async function parkForRefusedPartnerTransition(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  applicationRef: string,
  providerKey: string,
  attemptedStatus: string,
  reason: string
) {
  await parkForPartnerEvent(
    supabase,
    applicationId,
    applicationRef,
    "visa_partner_transition_refused",
    "Partner status update could not be applied",
    `${providerKey} reported "${attemptedStatus}", mapped correctly, but applying it was refused: ${reason}`,
    { applicationId, applicationRef, providerKey, attemptedStatus, reason }
  );
}
