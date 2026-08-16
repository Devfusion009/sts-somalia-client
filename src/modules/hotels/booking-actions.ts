"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { assertAgencyCanBookProduct, createOrderForBooking, getActiveAgencyId } from "@/modules/orders/helpers";
import { resolveBookedForCustomer } from "@/modules/agencies/booked-for";

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

  const guestNamesRaw = formData.get("guestNames")?.toString() ?? "";
  const guestDetails = guestNamesRaw
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((full_name) => ({ full_name }));

  const profile = await requireUser();
  const supabase = await createClient();

  const { data: room, error: roomError } = await supabase
    .from("hotel_rooms")
    .select("id, hotel_id, base_price, currency, status, hotel:hotels(booking_mode)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .eq("status", "published")
    .maybeSingle();

  if (roomError || !room) {
    return { error: "This room is no longer available." };
  }
  const isManualHotel = (room.hotel as { booking_mode?: string } | null)?.booking_mode !== "instant";

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  );

  // Nightly pricing honors the partner's per-date price_override — the same
  // pattern Umrah departures already use (price_override ?? base_price).
  // Before this, a partner setting a seasonal rate changed what their portal
  // displayed but not what the customer was actually charged.
  const { data: inventoryRows } = await supabase
    .from("hotel_room_inventory")
    .select("date, price_override")
    .eq("room_id", room.id)
    .gte("date", checkIn)
    .lt("date", checkOut);
  const overrideByDate = new Map(
    (inventoryRows ?? [])
      .filter((r) => r.price_override !== null)
      .map((r) => [r.date, Number(r.price_override)])
  );
  let totalPrice = 0;
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < nights; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    totalPrice += (overrideByDate.get(iso) ?? room.base_price) * numRooms;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "hotel");
  if (!access.ok) return { error: access.message };
  const agencyCustomerId = await resolveBookedForCustomer(supabase, agencyId, formData);

  const bookingRow = {
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
    guest_details: guestDetails,
    total_price: totalPrice,
    currency: room.currency,
  };

  let { data: booking, error: bookingError } = await supabase
    .from("hotel_bookings")
    .insert(bookingRow)
    .select()
    .single();

  // Manual-booking workflow: full nights don't reject the request. The
  // reserve trigger raises 'not enough rooms available on <date>' — catch
  // exactly that and park the request as 'waitlisted' instead (the trigger
  // skips reservation for waitlisted rows). Staff work it from the admin
  // queue; promotion re-checks availability at that moment.
  let waitlisted = false;
  if (bookingError?.message.includes("not enough rooms available")) {
    waitlisted = true;
    ({ data: booking, error: bookingError } = await supabase
      .from("hotel_bookings")
      .insert({ ...bookingRow, status: "waitlisted" })
      .select()
      .single());
  }

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create booking." };
  }

  // Holds are an agency-only entry point ("book now, decide later") — the
  // form only renders the Hold button when an agent is signed in.
  const hold = Boolean(agencyId) && formData.get("intent") === "hold";

  let order;
  try {
    order = await createOrderForBooking(supabase, {
      customerId: profile.id,
      bookedBy: profile.id,
      agencyId,
      agencyCustomerId,
      currency: room.currency,
      itemType: "hotel",
      price: totalPrice,
      hotelBookingId: booking.id,
      hold,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create order." };
  }

  // A waitlisted request has no confirmed room yet, so pushing the customer
  // into payment would charge them for nights nobody has granted. They land
  // on their booking's tracking page instead; checkout happens after staff
  // confirm a slot.
  if (waitlisted) {
    redirect(`/account/bookings/${order.id}?waitlisted=1`);
  }

  // Manual-booking hotels (no live API): the booking is a REQUEST until STS
  // checks with the hotel and confirms it. Payment only happens after
  // confirmation, from the customer's booking page — never at request time.
  if (isManualHotel && !hold) {
    redirect(`/account/bookings/${order.id}?requested=1`);
  }

  redirect(`/checkout/${order.id}`);
}
