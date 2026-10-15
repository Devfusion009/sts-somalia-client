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
import { todayIso } from "@/modules/hotels/availability";
import { notifyPartnerOfBooking } from "@/lib/notifications/partner-booking-notify";

const MAX_NIGHTS = 60;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * What one room costs for the whole stay: each night's per-date rate when the
 * hotel set one, else the base rate. The booking, the review page and the
 * order all price from this, so the figure shown is the figure charged.
 */
async function stayPricePerRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  room: { id: string; base_price: number },
  checkIn: string,
  checkOut: string,
) {
  const { data } = await supabase
    .from("hotel_room_inventory")
    .select("date, price_override")
    .eq("room_id", room.id)
    .gte("date", checkIn)
    .lt("date", checkOut);
  const overrides = new Map(
    (data ?? []).filter((r) => r.price_override !== null).map((r) => [r.date, Number(r.price_override)]),
  );
  let total = 0;
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < nightsBetween(checkIn, checkOut); i++) {
    total += overrides.get(cursor.toISOString().slice(0, 10)) ?? room.base_price;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

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
    .select("id, hotel_id, base_price, currency, status, max_occupancy, hotel:hotels(booking_mode)")
    .eq("id", roomId)
    .eq("hotel_id", hotelId)
    .eq("status", "published")
    .maybeSingle();

  if (roomError || !room) {
    return { error: "This room is no longer available." };
  }
  if (checkIn < todayIso()) return { error: "Check-in can't be in the past." };
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return { error: `Stays are limited to ${MAX_NIGHTS} nights.` };
  if (numAdults + numChildren > room.max_occupancy * numRooms) {
    return { error: `This room holds up to ${room.max_occupancy} guests per room.` };
  }
  const isManualHotel = (room.hotel as { booking_mode?: string } | null)?.booking_mode !== "instant";

  const totalPrice = (await stayPricePerRoom(supabase, room, checkIn, checkOut)) * numRooms;

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

  // The database allocator is the final gate: it seats the request when the
  // nights have capacity, seats an agency request ahead of unconfirmed
  // customer requests when they don't, and otherwise refuses the insert with
  // the rooms actually left — so no order exists for a stay nobody can host.
  const { data: booking, error: bookingError } = await supabase
    .from("hotel_bookings")
    .insert(bookingRow)
    .select()
    .single();

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
    // No order, no booking: release the rooms the insert just held.
    await supabase.from("hotel_bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return { error: err instanceof Error ? err.message : "Could not create order." };
  }

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

  // The desk keeps the agent in the portal for every outcome — its order
  // page reads the same waitlisted/requested/payable state off the order.
  if (isDeskBooking(formData, agencyId)) {
    return { error: null, destination: deskOrderPath(order.id), orderId: order.id };
  }

  // Manual-booking hotels (no live API): the booking is a REQUEST until STS
  // checks with the hotel and confirms it. Payment only happens after
  // confirmation, from the customer's booking page — never at request time.
  if (isManualHotel && !hold) {
    redirect(`/account/bookings/${order.id}?requested=1`);
  }

  redirect(`/checkout/${order.id}`);
}

/**
 * Rooms left and the per-room price for a stay, for the booking form to
 * refresh as the dates change. unitsLeft is null when the hotel hasn't set a
 * room count. Both come from public reads, the same ones the hotel page uses.
 */
export async function getStayQuote(
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ unitsLeft: number | null; pricePerRoom: number } | null> {
  const ids = z.string().uuid().safeParse(roomId);
  const dates = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (!ids.success || !dates.safeParse(checkIn).success || !dates.safeParse(checkOut).success || checkOut <= checkIn) {
    return null;
  }
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return null;

  const supabase = await createClient();
  const [{ data: room }, { data: left }] = await Promise.all([
    supabase.from("hotel_rooms").select("id, base_price").eq("id", ids.data).eq("status", "published").maybeSingle(),
    supabase.rpc("room_units_left", { p_room_ids: [ids.data], p_check_in: checkIn, p_check_out: checkOut }),
  ]);
  if (!room) return null;
  const row = left?.[0];
  return {
    unitsLeft: row ? Math.max(0, row.units_left) : null,
    pricePerRoom: await stayPricePerRoom(supabase, room, checkIn, checkOut),
  };
}
