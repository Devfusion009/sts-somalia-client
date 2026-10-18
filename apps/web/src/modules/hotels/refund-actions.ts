"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireHotelPermission, revalidateHotelDesk } from "@/modules/hotels/hotel-access";

export type RefundActionState = { error: string | null } | null;

const ruleSchema = z.object({
  hotelId: z.string().uuid(),
  daysBefore: z.coerce.number().int("Enter whole days.").min(0, "Days cannot be negative.").max(730, "Enter 730 days or fewer."),
  deductionPercent: z.coerce.number().min(0, "Deduction cannot be negative.").max(100, "Deduction cannot exceed 100%."),
});

/** Adds a rule, or updates the deduction when that day threshold already has one. */
export async function saveRefundRule(_prev: RefundActionState, formData: FormData): Promise<RefundActionState> {
  const parsed = ruleSchema.safeParse({
    hotelId: formData.get("hotelId"),
    daysBefore: formData.get("daysBefore"),
    deductionPercent: formData.get("deductionPercent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { hotelId, daysBefore, deductionPercent } = parsed.data;

  if (!(await requireHotelPermission(hotelId, "profile"))) {
    return { error: "You don't have permission to edit refund rules." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hotel_refund_rules")
    .upsert(
      { hotel_id: hotelId, days_before: daysBefore, deduction_percent: deductionPercent },
      { onConflict: "hotel_id,days_before" }
    );
  if (error) return { error: error.message };

  revalidateHotelDesk(hotelId);
  return { error: null };
}

export async function deleteRefundRule(formData: FormData): Promise<void> {
  const ruleId = z.string().uuid().safeParse(formData.get("ruleId"));
  const hotelId = z.string().uuid().safeParse(formData.get("hotelId"));
  if (!ruleId.success || !hotelId.success) return;

  if (!(await requireHotelPermission(hotelId.data, "profile"))) return;

  const supabase = await createClient();
  await supabase.from("hotel_refund_rules").delete().eq("id", ruleId.data).eq("hotel_id", hotelId.data);
  revalidateHotelDesk(hotelId.data);
}

const decisionSchema = z.object({
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  amount: z.coerce.number().min(0, "Amount cannot be negative.").optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

/**
 * Approve or decline a customer request on this hotel's booking. The SQL
 * function re-checks the caller, caps the refund at the booking total and, on
 * an approved cancellation or refund, cancels the stay in the same transaction.
 */
export async function decideBookingRequest(_prev: RefundActionState, formData: FormData): Promise<RefundActionState> {
  const amountRaw = formData.get("amount")?.toString().trim();
  const parsed = decisionSchema.safeParse({
    hotelId: formData.get("hotelId"),
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    amount: amountRaw ? amountRaw : undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { hotelId, requestId, decision, amount, note } = parsed.data;

  if (!(await requireHotelPermission(hotelId, "bookings"))) {
    return { error: "You don't have permission to decide requests." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_hotel_booking_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_amount: decision === "approved" ? amount : undefined,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidateHotelDesk(hotelId);
  return { error: null };
}
