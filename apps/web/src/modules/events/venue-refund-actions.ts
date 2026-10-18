"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireVenueAccess, revalidateVenueDesk } from "@/modules/events/venue-access";

export type VenueRefundState = { error: string | null } | null;

const ruleSchema = z.object({
  venueId: z.string().uuid(),
  daysBefore: z.coerce.number().int("Enter whole days.").min(0, "Days cannot be negative.").max(730, "Enter 730 days or fewer."),
  deductionPercent: z.coerce.number().min(0, "Deduction cannot be negative.").max(100, "Deduction cannot exceed 100%."),
});

export async function saveVenueRefundRule(_prev: VenueRefundState, formData: FormData): Promise<VenueRefundState> {
  const parsed = ruleSchema.safeParse({
    venueId: formData.get("venueId"),
    daysBefore: formData.get("daysBefore"),
    deductionPercent: formData.get("deductionPercent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { venueId, daysBefore, deductionPercent } = parsed.data;
  if (!(await requireVenueAccess(venueId, "profile"))) return { error: "You don't have permission to edit refund rules." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_refund_rules")
    .upsert({ venue_id: venueId, days_before: daysBefore, deduction_percent: deductionPercent }, { onConflict: "venue_id,days_before" });
  if (error) return { error: error.message };
  revalidateVenueDesk(venueId);
  return { error: null };
}

export async function deleteVenueRefundRule(formData: FormData): Promise<void> {
  const ruleId = z.string().uuid().safeParse(formData.get("ruleId"));
  const venueId = z.string().uuid().safeParse(formData.get("venueId"));
  if (!ruleId.success || !venueId.success) return;
  if (!(await requireVenueAccess(venueId.data, "profile"))) return;

  const supabase = await createClient();
  await supabase.from("venue_refund_rules").delete().eq("id", ruleId.data).eq("venue_id", venueId.data);
  revalidateVenueDesk(venueId.data);
}

const decisionSchema = z.object({
  venueId: z.string().uuid(),
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  amount: z.coerce.number().min(0, "Amount cannot be negative.").optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

/** Approve or decline a customer request on this venue's booking (resolve_hall_booking_request). */
export async function decideHallBookingRequest(_prev: VenueRefundState, formData: FormData): Promise<VenueRefundState> {
  const amountRaw = formData.get("amount")?.toString().trim();
  const parsed = decisionSchema.safeParse({
    venueId: formData.get("venueId"),
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    amount: amountRaw ? amountRaw : undefined,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { venueId, requestId, decision, amount, note } = parsed.data;
  if (!(await requireVenueAccess(venueId, "bookings"))) return { error: "You don't have permission to decide requests." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_hall_booking_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_amount: decision === "approved" ? amount : undefined,
    p_note: note,
  });
  if (error) return { error: error.message };
  revalidateVenueDesk(venueId);
  return { error: null };
}
