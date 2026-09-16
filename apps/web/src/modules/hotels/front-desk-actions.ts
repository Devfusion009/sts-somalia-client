"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";

export type FrontDeskActionState = { error: string | null } | null;

const bookingSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomTypeId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-in date."),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-out date."),
    numRooms: z.coerce.number().int().min(1).max(20),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "Check-out date must be after check-in date.",
    path: ["checkOut"],
  });

/**
 * "Add Booking" from the Front Desk grid — a manager creating a walk-in or
 * phone reservation directly, room-type + quantity only (no guest name yet;
 * the reference flow captures that later, in Edit). Room-unit assignment
 * isn't part of this: like createHotelBooking, this inserts straight into
 * hotel_bookings and the existing capacity-allocator trigger on that table
 * decides seated vs waitlisted — no separate RPC to call, no reimplementing
 * that logic here. Assigning a specific physical room is the front desk's
 * Reallocate/Swap action (phase C), same as the customer-facing flow.
 */
export async function createFrontDeskBooking(
  _prev: FrontDeskActionState,
  formData: FormData
): Promise<FrontDeskActionState> {
  const parsed = bookingSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomTypeId: formData.get("roomTypeId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    numRooms: formData.get("numRooms"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { hotelId, roomTypeId, checkIn, checkOut, numRooms } = parsed.data;

  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "bookings")) {
    return { error: "You don't have permission to create bookings for this hotel." };
  }

  const supabase = await createClient();
  const { data: roomType, error: roomError } = await supabase
    .from("hotel_rooms")
    .select("id, base_price, currency")
    .eq("id", roomTypeId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (roomError || !roomType) return { error: "Room type not found." };

  const nights = Math.max(
    1,
    Math.round((new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000)
  );

  const { data: inventoryRows } = await supabase
    .from("hotel_room_inventory")
    .select("date, price_override")
    .eq("room_id", roomType.id)
    .gte("date", checkIn)
    .lt("date", checkOut);
  const overrideByDate = new Map(
    (inventoryRows ?? []).filter((r) => r.price_override !== null).map((r) => [r.date, Number(r.price_override)])
  );

  let totalPrice = 0;
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < nights; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    totalPrice += (overrideByDate.get(iso) ?? Number(roomType.base_price)) * numRooms;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const { error: insertError } = await supabase.from("hotel_bookings").insert({
    hotel_id: hotelId,
    room_id: roomType.id,
    customer_id: profile.id,
    booked_by: profile.id,
    agency_id: null,
    channel: "b2c",
    check_in: checkIn,
    check_out: checkOut,
    num_rooms: numRooms,
    num_adults: 1,
    num_children: 0,
    guest_details: [],
    total_price: totalPrice,
    currency: roomType.currency,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/manager/${hotelId}/front-desk`);
  return { error: null };
}

async function requireBookingAccess(bookingId: string) {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data: booking } = await supabase.from("hotel_bookings").select("id, hotel_id").eq("id", bookingId).maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  const managed = await getMyManagedHotel(profile.id, booking.hotel_id);
  if (!managed || !hasPermission(managed, "bookings")) throw new Error("Not permitted.");
  return { supabase, hotelId: booking.hotel_id };
}

/** Physical check-in — a front-desk action, separate from the booking's own confirmed/pending status (see hotel_booking_front_desk_status). */
export async function checkInBooking(formData: FormData): Promise<void> {
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return;
  try {
    const { supabase, hotelId } = await requireBookingAccess(bookingId.data);
    await supabase.from("hotel_bookings").update({ checked_in_at: new Date().toISOString() }).eq("id", bookingId.data);
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch {
    // Best-effort: a permission or lookup failure here just leaves the
    // booking unchanged — no partial state to unwind.
  }
}

export async function checkOutBooking(formData: FormData): Promise<void> {
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return;
  try {
    const { supabase, hotelId } = await requireBookingAccess(bookingId.data);
    await supabase.from("hotel_bookings").update({ checked_out_at: new Date().toISOString() }).eq("id", bookingId.data);
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch {
    // See checkInBooking.
  }
}

export async function setBookingRoomLock(formData: FormData): Promise<void> {
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const locked = formData.get("locked") === "true";
  if (!bookingId.success) return;
  try {
    const { supabase, hotelId } = await requireBookingAccess(bookingId.data);
    await supabase.from("hotel_booking_room_units").update({ locked }).eq("booking_id", bookingId.data);
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch {
    // See checkInBooking.
  }
}

const assignSchema = z.object({ bookingId: z.string().uuid(), roomUnitId: z.string().uuid() });

/**
 * Reallocate/Swap — assign a booking to a specific physical room. Routed
 * through assign_hotel_booking_room_unit() (one SQL statement with a
 * row-locked overlap check), not a plain insert here, so two concurrent
 * assigns can't both land on the same room for the same nights.
 */
export async function assignRoomUnit(_prev: FrontDeskActionState, formData: FormData): Promise<FrontDeskActionState> {
  const parsed = assignSchema.safeParse({
    bookingId: formData.get("bookingId"),
    roomUnitId: formData.get("roomUnitId"),
  });
  if (!parsed.success) return { error: "Pick a room." };

  try {
    const { supabase, hotelId } = await requireBookingAccess(parsed.data.bookingId);
    const { error } = await supabase.rpc("assign_hotel_booking_room_unit", {
      p_booking_id: parsed.data.bookingId,
      p_room_unit_id: parsed.data.roomUnitId,
    });
    if (error) return { error: error.message };
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not assign room." };
  }
  return { error: null };
}

const detailsSchema = z
  .object({
    bookingId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-in date."),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-out date."),
    totalPrice: z.coerce.number().min(0),
    numAdults: z.coerce.number().int().min(1).max(30),
    numChildren: z.coerce.number().int().min(0).max(30),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: "Check-out date must be after check-in date.", path: ["checkOut"] });

/**
 * Edit modal — dates, price, and occupancy. A date change goes through
 * reschedule_hotel_booking() (the real capacity allocator, re-run for the
 * new dates, excluding this booking's own current hold) before anything
 * else is touched — if it can't fit, nothing about the booking changes,
 * not even price/occupancy, so this never leaves a booking half-updated.
 */
export async function updateBookingDetails(
  _prev: FrontDeskActionState,
  formData: FormData
): Promise<FrontDeskActionState> {
  const parsed = detailsSchema.safeParse({
    bookingId: formData.get("bookingId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    totalPrice: formData.get("totalPrice"),
    numAdults: formData.get("numAdults"),
    numChildren: formData.get("numChildren"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { supabase, hotelId } = await requireBookingAccess(parsed.data.bookingId);

    const { error: rescheduleError } = await supabase.rpc("reschedule_hotel_booking", {
      p_booking_id: parsed.data.bookingId,
      p_new_check_in: parsed.data.checkIn,
      p_new_check_out: parsed.data.checkOut,
    });
    if (rescheduleError) return { error: rescheduleError.message };

    const { error } = await supabase
      .from("hotel_bookings")
      .update({
        total_price: parsed.data.totalPrice,
        num_adults: parsed.data.numAdults,
        num_children: parsed.data.numChildren,
      })
      .eq("id", parsed.data.bookingId);
    if (error) return { error: error.message };
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update booking." };
  }
  return { error: null };
}

const rescheduleSchema = z
  .object({
    bookingId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: "Check-out date must be after check-in date." });

/** Drag-to-reschedule / drag-corner-to-extend — same safe path as the Edit dialog's date fields, just triggered by a drag instead of a form submit. */
export async function rescheduleBooking(_prev: FrontDeskActionState, formData: FormData): Promise<FrontDeskActionState> {
  const parsed = rescheduleSchema.safeParse({
    bookingId: formData.get("bookingId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid dates." };

  try {
    const { supabase, hotelId } = await requireBookingAccess(parsed.data.bookingId);
    const { error } = await supabase.rpc("reschedule_hotel_booking", {
      p_booking_id: parsed.data.bookingId,
      p_new_check_in: parsed.data.checkIn,
      p_new_check_out: parsed.data.checkOut,
    });
    if (error) return { error: error.message };
    revalidatePath(`/manager/${hotelId}/front-desk`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not reschedule booking." };
  }
  return { error: null };
}

const disableRoomSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomUnitId: z.string().uuid(),
    dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.dateEnd >= d.dateStart, { message: "End date must be on or after the start date.", path: ["dateEnd"] });

/** Disable Room — a date-ranged block on one physical room (hotel_room_disable_dates), not a standing toggle. */
export async function disableRoomUnit(_prev: FrontDeskActionState, formData: FormData): Promise<FrontDeskActionState> {
  const parsed = disableRoomSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomUnitId: formData.get("roomUnitId"),
    dateStart: formData.get("dateStart"),
    dateEnd: formData.get("dateEnd"),
    reason: formData.get("reason")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, parsed.data.hotelId);
  if (!managed || !hasPermission(managed, "rooms")) return { error: "You don't have permission to manage rooms for this hotel." };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_room_disable_dates").insert({
    room_unit_id: parsed.data.roomUnitId,
    date_start: parsed.data.dateStart,
    date_end: parsed.data.dateEnd,
    reason: parsed.data.reason ?? null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/manager/${parsed.data.hotelId}/front-desk`);
  return { error: null };
}
