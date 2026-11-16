"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type FlightAdminState = { error?: string; ok?: string } | null;

/**
 * Sends a failed booking back to the ticketing worker. Only for a booking
 * staff have checked has no order with the airline yet: the worker creates a
 * new one, so retrying a booking that did reach the airline books it twice.
 */
export async function retryFlightTicketing(_prev: FlightAdminState, formData: FormData): Promise<FlightAdminState> {
  await requirePlatformAdmin();
  const parsed = z.object({ bookingId: z.uuid() }).safeParse({ bookingId: formData.get("bookingId") });
  if (!parsed.success) return { error: "Booking not found." };

  const { data, error } = await createAdminClient()
    .from("flight_bookings")
    .update({ ticketing_status: "queued", ticketing_attempts: 0, ticketing_error: null, ticketing_claimed_at: null })
    .eq("id", parsed.data.bookingId)
    .eq("ticketing_status", "failed")
    .is("provider_order_id", null)
    .select("id");
  if (error || !data?.length) return { error: "Only failed bookings can be retried." };

  revalidatePath("/admin/flights");
  return { ok: "Booking queued." };
}
