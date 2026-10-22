"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { notifyUmrahBooking } from "@/modules/umrah/notify";
import { stageErrorMessage } from "@/modules/umrah/stage-errors";
import type { Database } from "@/lib/types/database.types";

export type DepartureActionState = {
  error: string | null;
  message?: string;
  skipped?: { reference: string; reason: string }[];
} | null;

function revalidateDeparture(departureId?: string) {
  revalidatePath("/admin/umrah/departures");
  if (departureId) revalidatePath(`/admin/umrah/departures/${departureId}`);
  revalidatePath("/admin/umrah/bookings", "layout");
}

/** Releases seats held by unpaid group bookings and expired holds, now. */
export async function releaseUnpaidUmrahSeats(): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expire_unpaid_umrah_orders");
  if (error) return { error: error.message };
  revalidateDeparture();
  return { error: null, message: data === 1 ? "1 booking released." : `${data ?? 0} bookings released.` };
}

export async function cancelUmrahDeparture(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const departureId = z.string().uuid().safeParse(formData.get("departureId"));
  if (!departureId.success) return { error: "Invalid departure." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Enter a reason." };

  const supabase = await createClient();
  const { data: live } = await supabase
    .from("umrah_bookings")
    .select("id")
    .eq("departure_id", departureId.data)
    .in("status", ["pending", "confirmed"]);
  const { error } = await supabase.rpc("cancel_umrah_departure", {
    p_departure_id: departureId.data,
    p_reason: reason.slice(0, 500),
  });
  if (error) return { error: error.message };

  for (const booking of live ?? []) void notifyUmrahBooking(booking.id, "booking_cancelled", reason);
  revalidateDeparture(departureId.data);
  revalidatePath("/admin/refunds");
  return { error: null };
}

const stageSchema = z.enum(["confirmed", "visa_processing", "visa_issued", "travel_confirmed", "documents_ready", "completed"]);

/**
 * Moves every live booking on a departure that is behind `stage` forward to
 * it, one booking at a time through set_umrah_booking_stage, so each one is
 * checked (payment, readiness) exactly as a single move would be.
 */
export async function advanceDepartureBookings(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const departureId = z.string().uuid().safeParse(formData.get("departureId"));
  if (!departureId.success) return { error: "Invalid departure." };
  const stage = stageSchema.safeParse(formData.get("stage"));
  if (!stage.success) return { error: "Choose a stage." };

  const order = stageSchema.options;
  const behind: Database["public"]["Enums"]["umrah_fulfillment_stage"][] = [
    "booked",
    ...order.slice(0, order.indexOf(stage.data)),
  ];

  const supabase = await createClient();
  const { data: bookings, error: listError } = await supabase
    .from("umrah_bookings")
    .select("id, fulfillment_stage, order_items(order:order_id(order_number))")
    .eq("departure_id", departureId.data)
    .in("status", ["pending", "confirmed"])
    .in("fulfillment_stage", behind)
    .limit(1000);
  if (listError) return { error: listError.message };

  let moved = 0;
  const skipped: { reference: string; reason: string }[] = [];
  for (const booking of bookings ?? []) {
    const item = booking.order_items?.[0];
    const linked = Array.isArray(item?.order) ? item?.order[0] : item?.order;
    const reference = linked?.order_number ?? booking.id.slice(0, 8);
    const { error } = await supabase.rpc("set_umrah_booking_stage", {
      p_booking_id: booking.id,
      p_stage: stage.data,
    });
    if (error) {
      skipped.push({ reference, reason: stageErrorMessage(error.message) });
    } else {
      moved += 1;
      void notifyUmrahBooking(booking.id, "stage_changed", undefined, stage.data);
    }
  }

  revalidateDeparture(departureId.data);
  return { error: null, message: `${moved} moved, ${skipped.length} skipped.`, skipped };
}

const roomSchema = z.object({
  departureId: z.string().uuid(),
  city: z.enum(["makkah", "madinah"]),
  label: z.string().trim().min(1, "Enter a room number.").max(40),
  capacity: z.coerce.number().int().min(1, "Capacity must be 1 to 12.").max(12, "Capacity must be 1 to 12."),
  gender: z.union([z.enum(["male", "female", "family"]), z.literal("")]),
});

export async function createUmrahRoom(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const parsed = roomSchema.safeParse({
    departureId: formData.get("departureId"),
    city: formData.get("city"),
    label: formData.get("label"),
    capacity: formData.get("capacity"),
    gender: formData.get("gender") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("umrah_room_assignments").insert({
    departure_id: d.departureId,
    city: d.city,
    room_label: d.label,
    capacity: d.capacity,
    gender: d.gender || null,
  });
  if (error) return { error: error.code === "23505" ? "That room already exists in this city." : error.message };
  revalidateDeparture(d.departureId);
  return { error: null };
}

export async function deleteUmrahRoom(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const roomId = z.string().uuid().safeParse(formData.get("roomId"));
  if (!roomId.success) return { error: "Invalid room." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("umrah_room_assignments")
    .delete()
    .eq("id", roomId.data)
    .select("departure_id")
    .maybeSingle();
  if (error) return { error: error.message };
  revalidateDeparture(data?.departure_id);
  return { error: null };
}

/** Maps the occupant trigger's raise messages to one plain line. */
function roomErrorMessage(message: string) {
  if (message.includes("room is full")) return "This room is full.";
  if (message.includes("already has a room")) return "A pilgrim already has a room in this city.";
  if (message.includes("not on this departure")) return "That pilgrim is not on this departure.";
  return message;
}

/**
 * Puts a pilgrim, or every pilgrim of one booking (`booking:<id>`), into a
 * room. A booking's pilgrims go in together, in one insert, so either all
 * fit or none are added.
 */
export async function assignRoomOccupants(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const roomId = z.string().uuid().safeParse(formData.get("roomId"));
  if (!roomId.success) return { error: "Invalid room." };
  const target = String(formData.get("target") ?? "");

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("umrah_room_assignments")
    .select("id, departure_id")
    .eq("id", roomId.data)
    .maybeSingle();
  if (!room) return { error: "Room not found." };

  let pilgrimIds: string[] = [];
  if (target.startsWith("booking:")) {
    const bookingId = z.string().uuid().safeParse(target.slice("booking:".length));
    if (!bookingId.success) return { error: "Choose a pilgrim or booking." };
    const { data: pilgrims } = await supabase.from("umrah_pilgrims").select("id").eq("booking_id", bookingId.data);
    pilgrimIds = (pilgrims ?? []).map((p) => p.id);
  } else {
    const pilgrimId = z.string().uuid().safeParse(target);
    if (!pilgrimId.success) return { error: "Choose a pilgrim or booking." };
    pilgrimIds = [pilgrimId.data];
  }
  if (pilgrimIds.length === 0) return { error: "Choose a pilgrim or booking." };

  const { error } = await supabase
    .from("umrah_room_occupants")
    .insert(pilgrimIds.map((pilgrim_id) => ({ room_id: room.id, pilgrim_id })));
  if (error) return { error: error.code === "23505" ? "Already in this room." : roomErrorMessage(error.message) };

  revalidateDeparture(room.departure_id);
  return { error: null };
}

export async function removeRoomOccupant(
  _prev: DepartureActionState,
  formData: FormData
): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const roomId = z.string().uuid().safeParse(formData.get("roomId"));
  const pilgrimId = z.string().uuid().safeParse(formData.get("pilgrimId"));
  if (!roomId.success || !pilgrimId.success) return { error: "Invalid room." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_room_occupants")
    .delete()
    .eq("room_id", roomId.data)
    .eq("pilgrim_id", pilgrimId.data);
  if (error) return { error: error.message };
  const departureId = String(formData.get("departureId") ?? "");
  revalidateDeparture(departureId || undefined);
  return { error: null };
}
