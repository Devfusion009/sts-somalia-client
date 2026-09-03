"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  assertAgencyCanBookProduct,
  createOrderForBooking,
  deskOrderPath,
  getActiveAgencyId,
  isDeskBooking,
} from "@/modules/orders/helpers";
import { resolveBookedForCustomer } from "@/modules/agencies/booked-for";
import { notifyPartnerOfBooking } from "@/lib/notifications/partner-booking-notify";

export type ActionState = {
  error: string | null;
  destination?: string;
  orderId?: string;
} | null;

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

  // The database allocator decides the outcome: it seats the request when
  // the nights have capacity, seats an agency request ahead of unconfirmed
  // customer requests when they don't, and otherwise returns the row as
  // 'waitlisted'. Staff work waitlisted requests from the admin queue.
  const { data: booking, error: bookingError } = await supabase
    .from("hotel_bookings")
    .insert(bookingRow)
    .select()
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create booking." };
  }
  const waitlisted = booking.status === "waitlisted";

  // Org-level email/WhatsApp to the owning partner (the in-app bell already
  // reaches every partner staff member via the hotel_bookings insert
  // trigger). Best-effort — never blocks the booking on a send failure, and
  // skipped entirely for STS-managed hotels (partner_id null).
  const { data: hotelWithPartner } = await supabase
    .from("hotels")
    .select("name, partner:hotel_partners(contact_email, contact_phone)")
    .eq("id", room.hotel_id)
    .maybeSingle();
  if (hotelWithPartner?.partner) {
    void notifyPartnerOfBooking({
      partnerEmail: hotelWithPartner.partner.contact_email,
      partnerPhone: hotelWithPartner.partner.contact_phone,
      propertyName: hotelWithPartner.name,
      summary: `${numRooms} room(s), ${checkIn} → ${checkOut}`,
    }).catch(() => {});
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

  // The desk keeps the agent in the portal for every outcome — its order
  // page reads the same waitlisted/requested/payable state off the order.
  if (isDeskBooking(formData, agencyId)) {
    return { error: null, destination: deskOrderPath(order.id), orderId: order.id };
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
