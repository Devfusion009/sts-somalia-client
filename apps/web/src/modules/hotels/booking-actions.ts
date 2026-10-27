"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStayPrices } from "@/modules/hotels/rates";
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
import {
  ARRIVAL_TIME_OPTIONS,
  ROOM_PREFERENCES,
  occupancyTotals,
  parseOccupancy,
  readExtrasSnapshot,
  type BookedExtra,
  type RoomOccupancy,
  type RoomPreferenceKey,
  type StayDetails,
} from "@/modules/hotels/booking-options";

const MAX_NIGHTS = 60;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type QuoteBreakdown = {
  currency: string;
  nights: number;
  rooms: number;
  roomStay: number;
  roomsTotal: number;
  discount: number;
  boardTotal: number;
  extras: BookedExtra[];
  extrasTotal: number;
  total: number;
};

/**
 * The stay's price from quote_hotel_stay(): nightly rates (per-date rate,
 * else rate rule, else base) x rooms, the rate plan's discount and meal
 * supplement, and the chosen extras. The database charges this same figure.
 */
async function quoteStay(
  supabase: Supabase,
  args: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    numRooms: number;
    adults: number;
    children: number;
    ratePlanId: string | null;
    extraIds: string[];
  }
): Promise<{ breakdown: QuoteBreakdown; raw: unknown } | { error: string }> {
  const { data, error } = await supabase.rpc("quote_hotel_stay", {
    p_room_id: args.roomId,
    p_check_in: args.checkIn,
    p_check_out: args.checkOut,
    p_num_rooms: args.numRooms,
    p_adults: args.adults,
    p_children: args.children,
    p_rate_plan_id: args.ratePlanId,
    p_extra_ids: args.extraIds,
  });
  if (error || !data || typeof data !== "object") {
    return { error: error?.message ?? "Could not price this stay." };
  }
  const q = data as Record<string, unknown>;
  return {
    raw: data,
    breakdown: {
      currency: String(q.currency ?? "USD"),
      nights: Number(q.nights ?? 0),
      rooms: Number(q.rooms ?? 1),
      roomStay: Number(q.room_stay ?? 0),
      roomsTotal: Number(q.rooms_total ?? 0),
      discount: Number(q.discount ?? 0),
      boardTotal: Number(q.board_total ?? 0),
      extras: readExtrasSnapshot(q.extras),
      extrasTotal: Number(q.extras_total ?? 0),
      total: Number(q.total ?? 0),
    },
  };
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

  const { roomId, hotelId, checkIn, checkOut, specialRequests } = parsed.data;

  // Per-room occupancy ("2-1,2-0") from the booking page; the agent desk form
  // still posts plain totals.
  const occRaw = formData.get("occ")?.toString() ?? "";
  const occupancy: RoomOccupancy[] = occRaw ? parseOccupancy(occRaw) : [];
  const totals = occupancy.length > 0
    ? occupancyTotals(occupancy)
    : { rooms: parsed.data.numRooms, adults: parsed.data.numAdults, children: parsed.data.numChildren };
  const numRooms = totals.rooms;
  const numAdults = totals.adults;
  const numChildren = totals.children;

  const ratePlanRaw = formData.get("ratePlanId")?.toString() || null;
  const ratePlanId = ratePlanRaw && z.string().uuid().safeParse(ratePlanRaw).success ? ratePlanRaw : null;
  const extraIds = formData
    .getAll("extraIds")
    .map(String)
    .filter((id) => z.string().uuid().safeParse(id).success)
    .slice(0, 20);
  const stayDetails = readStayDetailsForm(formData, numRooms);

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
    .select("id, hotel_id, base_price, currency, status, max_occupancy")
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
  if (occupancy.some((r) => r.adults + r.children > room.max_occupancy)) {
    return { error: `This room holds up to ${room.max_occupancy} guests per room.` };
  }
  if (room.base_price <= 0) return { error: "This room has no price yet. Contact us to book it." };

  const quote = await quoteStay(supabase, {
    roomId: room.id,
    checkIn,
    checkOut,
    numRooms,
    adults: numAdults,
    children: numChildren,
    ratePlanId,
    extraIds,
  });
  if ("error" in quote) return { error: quote.error };
  const totalPrice = quote.breakdown.total;

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
    // No names typed: the booker is the lead guest, so every console shows a
    // name instead of "Guest" (front desk, bookings list, booking detail).
    guest_details: guestDetails.length > 0 || !profile.full_name ? guestDetails : [{ full_name: profile.full_name }],
    total_price: totalPrice,
    currency: room.currency,
    // The database re-prices a customer's or agency's booking with the same
    // quote_hotel_stay() call; staff bookings keep this figure.
    rate_plan_id: ratePlanId,
    extras: extraIds.map((id) => ({ id })),
    room_occupancy: occupancy,
    stay_details: stayDetails,
    price_breakdown: quote.raw as never,
  };

  // The database allocator is the final gate: it seats the booking when the
  // nights have capacity (status 'pending', payable now), seats an agency
  // request ahead of unpaid customer bookings when they don't, and otherwise
  // keeps a customer's booking as 'waitlisted' for an admin decision.
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
      price: Number(booking.total_price),
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

  // No rooms free: the booking waits in the admin Order Queue, and payment
  // opens from the booking page once an admin confirms it.
  if (booking.status === "waitlisted") {
    redirect(`/account/bookings/${order.id}?requested=1`);
  }

  redirect(`/checkout/${order.id}`);
}

export type StayQuote = {
  unitsLeft: number | null;
  pricePerRoom: number;
  /** One room's rate for each night of the stay, so the guest sees how the total is built. */
  nights: Array<{ night: string; rate: number }>;
  /** The full price for the chosen occupancy, rate plan and extras; null when the stay can't be priced. */
  breakdown: QuoteBreakdown | null;
  error?: string;
};

export type StayQuoteInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  rooms?: RoomOccupancy[];
  ratePlanId?: string | null;
  extraIds?: string[];
};

/**
 * Rooms left and the stay's price, for the booking page to refresh as the
 * guest changes dates, guests, rate or extras. unitsLeft is null when the
 * hotel hasn't set a room count. All public reads.
 */
export async function getStayQuote(input: StayQuoteInput): Promise<StayQuote | null> {
  const ids = z.string().uuid().safeParse(input.roomId);
  const dates = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const { checkIn, checkOut } = input;
  if (!ids.success || !dates.safeParse(checkIn).success || !dates.safeParse(checkOut).success || checkOut <= checkIn) {
    return null;
  }
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return null;

  const rooms = input.rooms && input.rooms.length > 0 ? parseOccupancy(input.rooms.map((r) => `${r.adults}-${r.children}`).join(",")) : [{ adults: 2, children: 0 }];
  const totals = occupancyTotals(rooms);
  const ratePlanId = input.ratePlanId && z.string().uuid().safeParse(input.ratePlanId).success ? input.ratePlanId : null;
  const extraIds = (input.extraIds ?? []).filter((id) => z.string().uuid().safeParse(id).success).slice(0, 20);

  const supabase = await createClient();
  const [{ data: room }, { data: left }] = await Promise.all([
    supabase.from("hotel_rooms").select("id, base_price").eq("id", ids.data).eq("status", "published").maybeSingle(),
    supabase.rpc("room_units_left", { p_room_ids: [ids.data], p_check_in: checkIn, p_check_out: checkOut }),
  ]);
  if (!room) return null;
  const row = left?.[0];
  const [price, quote] = await Promise.all([
    getStayPrices(supabase, [room], checkIn, checkOut),
    quoteStay(supabase, {
      roomId: room.id,
      checkIn,
      checkOut,
      numRooms: totals.rooms,
      adults: totals.adults,
      children: totals.children,
      ratePlanId,
      extraIds,
    }),
  ]);
  const stay = price.get(room.id);
  return {
    unitsLeft: row ? Math.max(0, row.units_left) : null,
    pricePerRoom: stay?.total ?? room.base_price * nightsBetween(checkIn, checkOut),
    nights: stay?.nights.map((n) => ({ night: n.night, rate: n.rate })) ?? [],
    breakdown: "error" in quote ? null : quote.breakdown,
    ...("error" in quote ? { error: quote.error } : {}),
  };
}

/** Arrival time, trip purpose, lead guest and per-room preferences from the booking page. */
function readStayDetailsForm(formData: FormData, numRooms: number): StayDetails {
  const details: StayDetails = {};
  const arrival = formData.get("arrivalTime")?.toString() ?? "";
  if ((ARRIVAL_TIME_OPTIONS as readonly string[]).includes(arrival)) details.arrival_time = arrival;
  const purpose = formData.get("purpose")?.toString();
  if (purpose === "leisure" || purpose === "business") details.purpose = purpose;
  if (formData.get("bookedForOther") === "on") {
    const name = formData.get("leadName")?.toString().trim().slice(0, 120) ?? "";
    const phone = formData.get("leadPhone")?.toString().trim().slice(0, 30) ?? "";
    if (name) {
      details.booked_for_other = true;
      details.lead_guest = { name, ...(phone ? { phone } : {}) };
    }
  }
  const preferences = Array.from({ length: Math.min(numRooms, 20) }, (_, i) => {
    const pref: Partial<Record<RoomPreferenceKey, string>> = {};
    for (const key of Object.keys(ROOM_PREFERENCES) as RoomPreferenceKey[]) {
      const value = formData.get(`pref-${i}-${key}`)?.toString() ?? "";
      if ((ROOM_PREFERENCES[key].options as readonly string[]).includes(value)) pref[key] = value;
    }
    return pref;
  });
  if (preferences.some((p) => Object.keys(p).length > 0)) details.preferences = preferences;
  return details;
}
