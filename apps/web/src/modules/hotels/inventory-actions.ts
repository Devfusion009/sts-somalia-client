"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope, type HotelScope } from "@/modules/hotels/partner-queries";
import type { ActionState } from "@/lib/auth/actions";

// Same membership-lookup pattern as partner-actions.ts's requireHotelScope
// (see the note there about redirect signals inside try/catch, and about
// why hotelIds — not partnerId — is the scope room/inventory actions check,
// so a hotel_manager's single assigned hotel works here too).
async function requireHotelScope(): Promise<HotelScope> {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  if (scope.hotelIds.length === 0) {
    throw new Error("No hotel access found for this user.");
  }
  return scope;
}

/** Room scoped through hotelIds, so an id can't be guessed. */
async function getOwnedRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  hotelId: string,
  hotelIds: string[]
) {
  if (!hotelIds.includes(hotelId)) return null;
  const { data } = await supabase
    .from("hotel_rooms")
    .select("id, hotel_id, hotels!inner(id, partner_id)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  return data;
}

const MAX_RANGE_DAYS = 366;

const rangeSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

function datesInRange(startDate: string, endDate: string): string[] | null {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > MAX_RANGE_DAYS) return null;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Bulk-set availability for a date range (inclusive). Upserts one row per
 * night; the payload never includes booked_units, so existing bookings on
 * already-capped dates are preserved by the on-conflict update.
 */
export async function setRoomInventory(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let scope: HotelScope;
  try {
    scope = await requireHotelScope();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = rangeSchema
    .safeParse({
      hotelId: formData.get("hotelId"),
      roomId: formData.get("roomId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const detail = z
    .object({
      totalUnits: z.coerce.number().int().min(0, "Units can't be negative.").max(1000),
      priceOverride: z.coerce.number().min(0).optional(),
    })
    .safeParse({
      totalUnits: formData.get("totalUnits"),
      priceOverride: formData.get("priceOverride") || undefined,
    });
  if (!detail.success) return { error: detail.error.issues[0].message };

  const dates = datesInRange(parsed.data.startDate, parsed.data.endDate);
  if (!dates) return { error: `Choose a range of at most ${MAX_RANGE_DAYS} days.` };

  const supabase = await createClient();
  const room = await getOwnedRoom(supabase, parsed.data.roomId, parsed.data.hotelId, scope.hotelIds);
  if (!room) return { error: "Room not found." };

  const { error } = await supabase.from("hotel_room_inventory").upsert(
    dates.map((date) => ({
      room_id: room.id,
      date,
      total_units: detail.data.totalUnits,
      price_override: detail.data.priceOverride ?? null,
    })),
    { onConflict: "room_id,date" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/partner/hotels/${parsed.data.hotelId}/rooms/${room.id}`);
  return { error: null };
}

/**
 * Remove caps for a range so those nights become unrestricted again. Nights
 * that already carry bookings are kept (their caps still bound the existing
 * reservations); the form explains this.
 */
export async function clearRoomInventory(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let scope: HotelScope;
  try {
    scope = await requireHotelScope();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = rangeSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const room = await getOwnedRoom(supabase, parsed.data.roomId, parsed.data.hotelId, scope.hotelIds);
  if (!room) return { error: "Room not found." };

  const { error } = await supabase
    .from("hotel_room_inventory")
    .delete()
    .eq("room_id", room.id)
    .gte("date", parsed.data.startDate)
    .lte("date", parsed.data.endDate);
  if (error) return { error: error.message };

  revalidatePath(`/partner/hotels/${parsed.data.hotelId}/rooms/${room.id}`);
  return { error: null };
}
