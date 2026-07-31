"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { createOrderForBooking, getActiveAgencyId } from "@/lib/booking/order-helpers";

export type ActionState = { error: string | null } | null;

const bookingSchema = z
  .object({
    roomId: z.string().uuid(),
    hotelId: z.string().uuid(),
    checkIn: z.string().min(1, "Check-in date is required."),
    checkOut: z.string().min(1, "Check-out date is required."),
    numRooms: z.coerce.number().int().min(1).max(20),
    numAdults: z.coerce.number().int().min(1).max(30),
    numChildren: z.coerce.number().int().min(0).max(30),
    specialRequests: z.string().optional(),
  })
  .refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
    message: "Check-out date must be after check-in date.",
    path: ["checkOut"],
  });

export async function createHotelBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingSchema.safeParse({
    roomId: formData.get("roomId"),
    hotelId: formData.get("hotelId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    numRooms: formData.get("numRooms"),
    numAdults: formData.get("numAdults"),
    numChildren: formData.get("numChildren"),
    specialRequests: formData.get("specialRequests"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { roomId, hotelId, checkIn, checkOut, numRooms, numAdults, numChildren, specialRequests } = parsed.data;

  const profile = await requireUser();
  const supabase = await createClient();

  const { data: room, error: roomError } = await supabase
    .from("hotel_rooms")
    .select("id, hotel_id, base_price, currency, status")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .eq("status", "published")
    .maybeSingle();

  if (roomError || !room) {
    return { error: "This room is no longer available." };
  }

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  );
  const totalPrice = room.base_price * numRooms * nights;
  const agencyId = await getActiveAgencyId(supabase, profile.id);

  const { data: booking, error: bookingError } = await supabase
    .from("hotel_bookings")
    .insert({
      hotel_id: room.hotel_id,
      room_id: room.id,
      customer_id: profile.id,
      booked_by: profile.id,
      agency_id: agencyId,
      check_in: checkIn,
      check_out: checkOut,
      num_rooms: numRooms,
      num_adults: numAdults,
      num_children: numChildren,
      special_requests: specialRequests || null,
      total_price: totalPrice,
      currency: room.currency,
    })
    .select()
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create booking." };
  }

  try {
    await createOrderForBooking(supabase, {
      customerId: profile.id,
      bookedBy: profile.id,
      agencyId,
      currency: room.currency,
      itemType: "hotel",
      price: totalPrice,
      hotelBookingId: booking.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create order." };
  }

  redirect("/account/bookings?success=hotel");
}
