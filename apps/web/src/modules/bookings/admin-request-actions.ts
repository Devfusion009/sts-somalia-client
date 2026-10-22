"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { notifyUmrahBooking } from "@/modules/umrah/notify";

export type AdminRequestState = { error: string | null } | null;

const schema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "completed"]),
  amount: z.coerce.number().min(0, "Amount cannot be negative.").optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

/**
 * Admin's side of a customer request. Hotel requests go through the same SQL
 * resolver the hotel uses, so approving one still cancels the stay and
 * notifies the guest; Umrah requests go through resolve_umrah_booking_request,
 * which cancels the booking on an approved cancellation. Other requests
 * (flight, visa) are updated directly. "Completed" means the refund has been paid out: the payment is
 * marked refunded and a fully refunded order becomes 'refunded'.
 */
export async function decideCustomerRequest(_prev: AdminRequestState, formData: FormData): Promise<AdminRequestState> {
  const profile = await requirePlatformAdmin();
  const amountRaw = formData.get("amount")?.toString().trim();
  const parsed = schema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    amount: amountRaw ? amountRaw : undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { requestId, decision, amount, note } = parsed.data;

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("booking_requests")
    .select("id, status, kind, hotel_booking_id, hall_booking_id, umrah_booking_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Request not found." };

  if (decision === "completed") {
    const { error } = await supabase.rpc("complete_booking_request", { p_request_id: requestId });
    if (error) return { error: error.message };
  } else if (request.hotel_booking_id || request.hall_booking_id) {
    const { error } = await supabase.rpc(request.hotel_booking_id ? "resolve_hotel_booking_request" : "resolve_hall_booking_request", {
      p_request_id: requestId,
      p_decision: decision,
      p_amount: decision === "approved" ? amount : undefined,
      p_note: note,
    });
    if (error) return { error: error.message };
  } else if (request.umrah_booking_id) {
    // Approving an Umrah cancellation ends the booking, releases its seats
    // and closes the stage track in the same transaction.
    const { error } = await supabase.rpc("resolve_umrah_booking_request", {
      p_request_id: requestId,
      p_decision: decision,
      p_amount: decision === "approved" ? amount : undefined,
      p_note: note,
    });
    if (error) return { error: error.message };
    if (decision === "approved" && request.kind === "cancellation") {
      void notifyUmrahBooking(request.umrah_booking_id, "booking_cancelled", note);
    }
  } else {
    if (request.status !== "requested" && request.status !== "in_review") {
      return { error: "This request is already closed." };
    }
    const { error } = await supabase
      .from("booking_requests")
      .update({
        status: decision,
        approved_amount: decision === "approved" ? (amount ?? null) : null,
        staff_note: note ?? null,
        resolved_by: profile.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/refunds");
  return { error: null };
}
