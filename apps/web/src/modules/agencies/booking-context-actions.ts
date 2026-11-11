"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import {
  BOOKING_CUSTOMER_COOKIE,
  BOOKING_CUSTOMER_MAX_AGE,
  MAX_BATCH_CUSTOMERS,
} from "./booking-context";
import { buildCustomerProfile } from "./customer-profile";

/**
 * None of these redirect. A Server Action redirect() to a portal path is
 * resolved by the App Router without re-entering proxy.ts, and this version
 * (16.2.12) sends the redirect-follow request with the wrong Host — which
 * the root-host isolation block in proxy.ts answers with a 404 for anything
 * under /agent. Callers navigate client-side instead; see
 * signInToPortalAction for the same workaround on the login path.
 */

async function setCookie(customerIds: string[]) {
  const store = await cookies();
  store.set(BOOKING_CUSTOMER_COOKIE, customerIds.join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: BOOKING_CUSTOMER_MAX_AGE,
  });
}

/**
 * Puts one or more of this agency's clients on the counter. Ids that aren't
 * the agency's own are dropped rather than rejected loudly — the only way to
 * hold one is a tampered cookie or a stale page.
 */
export async function selectBookingCustomers(
  customerIds: string[]
): Promise<{ error: string | null }> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) {
    return { error: "You are not an active member of an agency." };
  }

  const requested = [...new Set(customerIds.filter(Boolean))].slice(0, MAX_BATCH_CUSTOMERS);
  if (requested.length === 0) {
    return { error: "Choose at least one customer." };
  }

  const { data } = await supabase
    .from("agency_customers")
    .select("id")
    .eq("agency_id", agencyId)
    .in("id", requested);

  const allowed = new Set((data ?? []).map((row) => row.id));
  const ordered = requested.filter((id) => allowed.has(id));
  if (ordered.length === 0) {
    return { error: "Customer not found." };
  }

  await setCookie(ordered);
  revalidatePath("/agent/book", "layout");
  return { error: null };
}

/** Single-customer convenience for the one-click "Select"/"Book" buttons. */
export async function selectBookingCustomer(customerId: string): Promise<{ error: string | null }> {
  return selectBookingCustomers([customerId]);
}

export async function clearBookingCustomer() {
  const store = await cookies();
  store.delete(BOOKING_CUSTOMER_COOKIE);
  revalidatePath("/agent/book", "layout");
}

/**
 * The walk-in case: someone at the counter who isn't in the client book yet.
 * Creating and selecting in one step is the whole point — a separate "add
 * customer, then find them again" round trip is the thing that makes this
 * slow at volume.
 */
export async function createBookingCustomer(
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

  const { data, error } = await supabase
    .from("agency_customers")
    .insert(built.row)
    .select("id")
    .single();

  if (error || !data) {
    if (built.uploadedPath) await supabase.storage.from("customer-documents").remove([built.uploadedPath]);
    return { error: error?.message ?? "Could not save this customer." };
  }

  await setCookie([data.id]);
  revalidatePath("/agent/book", "layout");
  revalidatePath("/agent/customers");
  return { error: null };
}
