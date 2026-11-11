"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { buildCustomerProfile } from "./customer-profile";

export async function createAgencyCustomer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) {
    return { error: "You are not an active member of an agency." };
  }

  const built = await buildCustomerProfile(supabase, agencyId, profile.id, formData);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase.from("agency_customers").insert(built.row);
  if (error) {
    if (built.uploadedPath) await supabase.storage.from("customer-documents").remove([built.uploadedPath]);
    return { error: error.message };
  }

  revalidatePath("/agent/customers");
  return { error: null };
}

export async function updateAgencyCustomer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) {
    return { error: "You are not an active member of an agency." };
  }

  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !customerId) {
    return { error: "Invalid customer." };
  }

  const { data: existing } = await supabase.from("agency_customers")
    .select("id, passport_file_path").eq("id", customerId).eq("agency_id", agencyId).maybeSingle();
  if (!existing) return { error: "Customer not found." };

  const built = await buildCustomerProfile(supabase, agencyId, profile.id, formData, existing.passport_file_path);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase.from("agency_customers")
    .update(built.fields).eq("id", customerId).eq("agency_id", agencyId);
  if (error) {
    if (built.uploadedPath) await supabase.storage.from("customer-documents").remove([built.uploadedPath]);
    return { error: error.message };
  }

  revalidatePath("/agent/customers");
  revalidatePath(`/agent/customers/${customerId}`);
  revalidatePath("/agent/book", "layout");
  return { error: null };
}

export async function deleteAgencyCustomer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) {
    return { error: "You are not an active member of an agency." };
  }

  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !customerId) {
    return { error: "Invalid customer." };
  }

  // A customer with booking history is a financial record, not a contact —
  // orders reference them for commission and voucher trails.
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("agency_customer_id", customerId);
  if ((count ?? 0) > 0) {
    return { error: "This customer has bookings and can't be deleted." };
  }

  const { error } = await supabase
    .from("agency_customers")
    .delete()
    .eq("id", customerId)
    .eq("agency_id", agencyId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/agent/customers");
  return { error: null };
}
