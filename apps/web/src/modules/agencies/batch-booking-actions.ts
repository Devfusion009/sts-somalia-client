"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { createHotelBooking } from "@/modules/hotels/booking-actions";
import { createUmrahBooking } from "@/modules/umrah/actions";
import { createHallBooking } from "@/modules/events/actions";
import { requestFlightQuote, type QuoteActionState } from "@/modules/flights/actions";
import { initiatePayment } from "@/modules/payments/actions";
import { getBookingCustomers } from "./booking-context";

/**
 * Places the same product for every customer on the counter.
 *
 * Runs the vertical's own booking action once per customer rather than
 * re-implementing it: the hotel allocator, seat accounting, partner
 * notifications, markup and hold behaviour all have to stay identical to a
 * single booking, and the only honest way to guarantee that is to use the
 * same code path. Sequential on purpose — the hotel allocator takes a
 * per-room advisory lock, so firing 30 of these in parallel would just queue
 * them behind each other with more contention.
 *
 * Partial success is a real outcome (a departure runs out of seats halfway
 * through), and the bookings that did succeed are real bookings — they are
 * kept and the names that failed are reported.
 */
const RUNNERS = {
  hotel: createHotelBooking,
  umrah: createUmrahBooking,
  hall: createHallBooking,
} as const;

type BatchVertical = keyof typeof RUNNERS;

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function cloneFor(formData: FormData, customerId: string): FormData {
  const clone = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === "agencyCustomerId" || key === "desk") continue;
    clone.append(key, value);
  }
  clone.set("agencyCustomerId", customerId);
  clone.set("desk", "1");
  return clone;
}

export async function createBatchBooking(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vertical = formData.get("vertical");
  const runner =
    typeof vertical === "string" && vertical in RUNNERS
      ? RUNNERS[vertical as BatchVertical]
      : null;
  if (!runner) return { error: "Unknown booking type." };

  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) return { error: "You are not an active member of an agency." };

  const customers = await getBookingCustomers(supabase, agencyId);
  if (customers.length === 0) return { error: "Choose at least one customer." };

  const batchId = crypto.randomUUID();
  const orderIds: string[] = [];
  const failed: string[] = [];

  for (const customer of customers) {
    let result: ActionState;
    try {
      result = await runner(null, cloneFor(formData, customer.id));
    } catch (error) {
      if (isRedirectError(error)) throw error;
      failed.push(customer.full_name);
      continue;
    }

    if (result?.orderId) {
      orderIds.push(result.orderId);
    } else {
      failed.push(customer.full_name);
    }
  }

  if (orderIds.length === 0) {
    return {
      error:
        failed.length > 0
          ? `Could not book for ${failed.join(", ")}.`
          : "Nothing was booked.",
    };
  }

  // Admin client for the stamp only: the orders were just created by this
  // agent, and this avoids depending on an UPDATE policy for orders that the
  // agent role isn't otherwise given.
  const admin = createAdminClient();
  const { error: stampError } = await admin
    .from("orders")
    .update({ booking_batch_id: batchId })
    .in("id", orderIds)
    .eq("agency_id", agencyId);

  if (stampError) return { error: stampError.message };

  const query = failed.length > 0 ? `?failed=${encodeURIComponent(failed.join(", "))}` : "";
  return { error: null, destination: `/agent/book/batch/${batchId}${query}` };
}

/**
 * Settles every unpaid order in a group from the agency balance.
 *
 * One order at a time through the normal payment action rather than a single
 * combined debit: each order keeps its own payment row, its own wallet ledger
 * entry and its own invoice, which is what makes one traveller cancellable
 * without unpicking the rest.
 */
export async function payBatchFromWallet(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const batchId = formData.get("batchId");
  if (typeof batchId !== "string" || !batchId) return { error: "Unknown group." };

  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) return { error: "You are not an active member of an agency." };

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status")
    .eq("agency_id", agencyId)
    .eq("booking_batch_id", batchId);

  const payable = (orders ?? []).filter((order) =>
    ["pending_payment", "held", "partially_paid"].includes(order.status)
  );
  if (payable.length === 0) return { error: "Nothing left to pay in this group." };

  let firstError: string | null = null;
  let paid = 0;

  for (const order of payable) {
    const perOrder = new FormData();
    perOrder.set("orderId", order.id);
    perOrder.set("methodId", "agency_wallet");
    perOrder.set("desk", "1");

    const result = await initiatePayment(null, perOrder);
    if (result?.error) {
      // Almost always the balance running out partway through — stop rather
      // than hammering the wallet with calls that will each fail the same way.
      firstError ??= result.error;
      break;
    }
    paid += 1;
  }

  revalidatePath(`/agent/book/batch/${batchId}`);

  if (firstError) {
    return { error: paid > 0 ? `Paid ${paid}. ${firstError}` : firstError };
  }
  return { error: null };
}

/**
 * Flights are quote requests, not orders — there is nothing to batch an id
 * onto and nothing to pay, so this just raises one request per customer and
 * reports the outcome.
 */
export async function createBatchFlightQuotes(
  _prevState: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) return { error: "You are not an active member of an agency." };

  const customers = await getBookingCustomers(supabase, agencyId);
  if (customers.length === 0) return { error: "Choose at least one customer." };

  const failed: string[] = [];
  let sent = 0;

  for (const customer of customers) {
    const result = await requestFlightQuote(null, cloneFor(formData, customer.id));
    if (result?.error) {
      failed.push(customer.full_name);
    } else {
      sent += 1;
    }
  }

  if (sent === 0) {
    return { error: `Could not send a request for ${failed.join(", ")}.` };
  }
  if (failed.length > 0) {
    return { error: `Sent ${sent}. Failed for ${failed.join(", ")}.` };
  }
  return { error: null, success: true };
}
