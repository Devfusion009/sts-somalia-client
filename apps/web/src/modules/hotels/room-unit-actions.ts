"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope } from "@/modules/hotels/partner-queries";
import { blockConflict } from "@/modules/hotels/block-guard";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Physical room units (room number + floor + standing status) under a room
 * type — the "input rooms with floors" step the front desk board reads
 * from. Same requireHotelScope/getOwnedRoom shape as inventory-actions.ts:
 * RLS is the real gate (hotel_room_units' own policies), this is just
 * enough of a check to avoid leaking whether an id exists before RLS runs.
 */
async function requireHotelScope() {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  if (scope.hotelIds.length === 0) {
    throw new Error("No hotel access found for this user.");
  }
  return scope;
}

async function getOwnedRoomType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomTypeId: string,
  hotelId: string,
  hotelIds: string[]
) {
  if (!hotelIds.includes(hotelId)) return null;
  const { data } = await supabase
    .from("hotel_rooms")
    .select("id, hotel_id")
    .eq("id", roomTypeId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  return data;
}

const addSchema = z.object({
  hotelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  roomNumber: z.string().trim().min(1, "Enter a room number.").max(20),
  floor: z.string().trim().max(20).optional(),
});

export async function addRoomUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomTypeId: formData.get("roomTypeId"),
    roomNumber: formData.get("roomNumber"),
    floor: formData.get("floor")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const scope = await requireHotelScope();
    const supabase = await createClient();
    const roomType = await getOwnedRoomType(supabase, parsed.data.roomTypeId, parsed.data.hotelId, scope.hotelIds);
    if (!roomType) return { error: "Room type not found." };

    const { error } = await supabase.from("hotel_room_units").insert({
      room_type_id: roomType.id,
      hotel_id: parsed.data.hotelId,
      room_number: parsed.data.roomNumber,
      floor: parsed.data.floor ?? null,
    });
    if (error) {
      return {
        error: error.code === "23505" ? `Room ${parsed.data.roomNumber} already exists in this hotel.` : error.message,
      };
    }
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Could not add room." };
  }

  revalidatePath("/manager/[hotelId]/rooms/[roomId]", "page");
  revalidatePath("/partner/hotels/[id]/rooms/[roomId]", "page");
  return { error: null };
}

const statusSchema = z.object({
  unitId: z.string().uuid(),
  status: z.enum(["active", "out_of_order", "inactive"]),
  reason: z.string().trim().max(300).optional(),
});

function todayPlus(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function setRoomUnitStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = statusSchema.safeParse({
    unitId: formData.get("unitId"),
    status: formData.get("status"),
    reason: formData.get("reason")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: "Choose a status." };

  await requireUser();
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("hotel_room_units")
    .select("id, hotel_id, room_type_id, status")
    .eq("id", parsed.data.unitId)
    .maybeSingle();
  if (!unit) return { error: "Room not found." };

  if (unit.status === "active" && parsed.data.status !== "active") {
    const conflict = await blockConflict(supabase, unit.hotel_id, unit.room_type_id, todayPlus(0), todayPlus(120));
    if (conflict) return { error: conflict };
  }

  const { error } = await supabase
    .from("hotel_room_units")
    .update({
      status: parsed.data.status,
      out_of_order_reason: parsed.data.status === "out_of_order" ? (parsed.data.reason ?? null) : null,
    })
    .eq("id", parsed.data.unitId);
  if (error) return { error: error.message };

  revalidatePath("/manager/[hotelId]/rooms/[roomId]", "page");
  revalidatePath("/partner/hotels/[id]/rooms/[roomId]", "page");
  return { error: null };
}

const blockSchema = z
  .object({
    unitId: z.string().uuid(),
    dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the room returns."),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.dateEnd > d.dateStart, { message: "The room must return after the start date.", path: ["dateEnd"] });

/** Takes one room out of sale from dateStart until dateEnd (the night it is back; not blocked). */
export async function addRoomBlock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = blockSchema.safeParse({
    unitId: formData.get("unitId"),
    dateStart: formData.get("dateStart"),
    dateEnd: formData.get("dateEnd"),
    reason: formData.get("reason")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const profile = await requireUser();
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("hotel_room_units")
    .select("id, hotel_id, room_type_id")
    .eq("id", parsed.data.unitId)
    .maybeSingle();
  if (!unit) return { error: "Room not found." };

  const conflict = await blockConflict(supabase, unit.hotel_id, unit.room_type_id, parsed.data.dateStart, parsed.data.dateEnd);
  if (conflict) return { error: conflict };

  const { error } = await supabase.from("hotel_room_disable_dates").insert({
    room_unit_id: unit.id,
    date_start: parsed.data.dateStart,
    date_end: parsed.data.dateEnd,
    reason: parsed.data.reason ?? null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/manager/[hotelId]/rooms/[roomId]", "page");
  revalidatePath("/partner/hotels/[id]/rooms/[roomId]", "page");
  return { error: null };
}

export async function deleteRoomBlock(formData: FormData): Promise<void> {
  const blockId = z.string().uuid().safeParse(formData.get("blockId"));
  if (!blockId.success) return;

  await requireUser();
  const supabase = await createClient();
  await supabase.from("hotel_room_disable_dates").delete().eq("id", blockId.data);

  revalidatePath("/manager/[hotelId]/rooms/[roomId]", "page");
  revalidatePath("/partner/hotels/[id]/rooms/[roomId]", "page");
}

export async function deleteRoomUnit(formData: FormData): Promise<void> {
  const unitId = z.string().uuid().safeParse(formData.get("unitId"));
  if (!unitId.success) return;

  await requireUser();
  const supabase = await createClient();
  await supabase.from("hotel_room_units").delete().eq("id", unitId.data);

  revalidatePath("/manager/[hotelId]/rooms/[roomId]", "page");
  revalidatePath("/partner/hotels/[id]/rooms/[roomId]", "page");
}
