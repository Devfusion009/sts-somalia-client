"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireHotelPermission, revalidateHotelDesk } from "@/modules/hotels/hotel-access";
import { BOARD_OPTIONS, EXTRA_UNIT_OPTIONS } from "@/modules/hotels/booking-options";

export type PlanActionState = { error: string | null } | null;

const money = z.coerce.number().min(0, "Enter zero or more.").max(100000);

const planSchema = z
  .object({
    hotelId: z.string().uuid(),
    name: z.string().trim().min(1, "Enter a name.").max(60, "Keep the name under 60 characters."),
    board: z.enum(BOARD_OPTIONS as [string, ...string[]]),
    boardPriceAdult: money,
    boardPriceChild: money,
    cancellation: z.enum(["flexible", "non_refundable"]),
    freeCancelDays: z.coerce.number().int().min(0).max(60).optional(),
    discountPercent: z.coerce.number().min(0, "Discount can't be negative.").max(90, "Discount can be at most 90%."),
  })
  .refine((d) => d.cancellation === "non_refundable" || d.freeCancelDays !== undefined, {
    message: "Enter the free cancellation days.",
    path: ["freeCancelDays"],
  });

export async function addRatePlan(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const parsed = planSchema.safeParse({
    hotelId: formData.get("hotelId"),
    name: formData.get("name"),
    board: formData.get("board"),
    boardPriceAdult: formData.get("boardPriceAdult") || 0,
    boardPriceChild: formData.get("boardPriceChild") || 0,
    cancellation: formData.get("cancellation"),
    freeCancelDays: formData.get("freeCancelDays") || undefined,
    discountPercent: formData.get("discountPercent") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const access = await requireHotelPermission(d.hotelId, "rooms");
  if (!access) return { error: "You don't have permission to edit rates." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("hotel_rate_plans")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", d.hotelId);
  const { error } = await supabase.from("hotel_rate_plans").insert({
    hotel_id: d.hotelId,
    name: d.name,
    board: d.board,
    board_price_adult: d.board === "room_only" ? 0 : d.boardPriceAdult,
    board_price_child: d.board === "room_only" ? 0 : d.boardPriceChild,
    cancellation: d.cancellation,
    free_cancel_days: d.cancellation === "flexible" ? (d.freeCancelDays ?? 0) : null,
    discount_percent: d.discountPercent,
    sort_order: count ?? 0,
    created_by: access.profileId,
  });
  if (error) return { error: error.message };

  revalidateHotelDesk(d.hotelId);
  return { error: null };
}

const toggleSchema = z.object({
  hotelId: z.string().uuid(),
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export async function setRatePlanActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    hotelId: formData.get("hotelId"),
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success || !(await requireHotelPermission(parsed.data.hotelId, "rooms"))) return;
  const supabase = await createClient();
  await supabase
    .from("hotel_rate_plans")
    .update({ is_active: parsed.data.active === "true" })
    .eq("id", parsed.data.id)
    .eq("hotel_id", parsed.data.hotelId);
  revalidateHotelDesk(parsed.data.hotelId);
}

const deleteSchema = z.object({ hotelId: z.string().uuid(), id: z.string().uuid() });

export async function deleteRatePlan(formData: FormData): Promise<void> {
  const parsed = deleteSchema.safeParse({ hotelId: formData.get("hotelId"), id: formData.get("id") });
  if (!parsed.success || !(await requireHotelPermission(parsed.data.hotelId, "rooms"))) return;
  const supabase = await createClient();
  await supabase.from("hotel_rate_plans").delete().eq("id", parsed.data.id).eq("hotel_id", parsed.data.hotelId);
  revalidateHotelDesk(parsed.data.hotelId);
}

const extraSchema = z.object({
  hotelId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
  price: z.coerce.number().positive("Enter a price above zero.").max(100000),
  unit: z.enum(EXTRA_UNIT_OPTIONS as [string, ...string[]]),
});

export async function addHotelExtra(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const parsed = extraSchema.safeParse({
    hotelId: formData.get("hotelId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const access = await requireHotelPermission(d.hotelId, "rooms");
  if (!access) return { error: "You don't have permission to edit extras." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("hotel_extras")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", d.hotelId);
  const { error } = await supabase.from("hotel_extras").insert({
    hotel_id: d.hotelId,
    name: d.name,
    description: d.description ?? null,
    price: d.price,
    unit: d.unit,
    sort_order: count ?? 0,
    created_by: access.profileId,
  });
  if (error) return { error: error.message };

  revalidateHotelDesk(d.hotelId);
  return { error: null };
}

export async function setHotelExtraActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    hotelId: formData.get("hotelId"),
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success || !(await requireHotelPermission(parsed.data.hotelId, "rooms"))) return;
  const supabase = await createClient();
  await supabase
    .from("hotel_extras")
    .update({ is_active: parsed.data.active === "true" })
    .eq("id", parsed.data.id)
    .eq("hotel_id", parsed.data.hotelId);
  revalidateHotelDesk(parsed.data.hotelId);
}

export async function deleteHotelExtra(formData: FormData): Promise<void> {
  const parsed = deleteSchema.safeParse({ hotelId: formData.get("hotelId"), id: formData.get("id") });
  if (!parsed.success || !(await requireHotelPermission(parsed.data.hotelId, "rooms"))) return;
  const supabase = await createClient();
  await supabase.from("hotel_extras").delete().eq("id", parsed.data.id).eq("hotel_id", parsed.data.hotelId);
  revalidateHotelDesk(parsed.data.hotelId);
}
