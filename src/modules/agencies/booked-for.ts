import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type TypedClient = SupabaseClient<Database>;

/**
 * Resolves the "booking for" selection a booking form submits: either an
 * existing agency customer id (validated against the agent's own agency),
 * or inline details that create a client-book entry on the fly. Returns
 * null when the user isn't an agent or is booking for themselves.
 */
export async function resolveBookedForCustomer(
  supabase: TypedClient,
  agencyId: string | null,
  formData: FormData
): Promise<string | null> {
  if (!agencyId) return null;

  const existing = formData.get("agencyCustomerId");
  if (typeof existing === "string" && existing && existing !== "self" && existing !== "new") {
    const { data } = await supabase
      .from("agency_customers")
      .select("id")
      .eq("id", existing)
      .eq("agency_id", agencyId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const newName = formData.get("newCustomerName");
  if (typeof newName === "string" && newName.trim().length >= 2) {
    const { data } = await supabase
      .from("agency_customers")
      .insert({
        agency_id: agencyId,
        full_name: newName.trim(),
        phone: (formData.get("newCustomerPhone") as string) || null,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  }

  return null;
}

/** Active agency customers for the booking-form picker. */
export async function getAgencyCustomers(supabase: TypedClient, agencyId: string) {
  const { data } = await supabase
    .from("agency_customers")
    .select("id, full_name, email, phone, notes, created_at")
    .eq("agency_id", agencyId)
    .order("full_name");
  return data ?? [];
}
