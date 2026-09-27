"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { todayIso } from "@/modules/hotels/availability";
import {
  OFFLINE_PAYMENT_METHODS,
  type ReservationResult,
  type StayQuote,
} from "@/modules/hotels/reservation-types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** hotel_availability() accepts at most 120 nights per call. */
const MAX_NIGHTS = 120;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000
  );
}

async function requireBookingManager(hotelId: string) {
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "bookings")) return null;
  return profile;
}

/**
 * Every sellable room type for one stay: rooms left (the lowest nightly
 * figure across the stay, from the same allocator ledger online search
 * reads) and the per-room price for the whole stay (per-date override,
 * else base rate — the same sum createReservation stores).
 */
async function buildQuote(hotelId: string, checkIn: string, checkOut: string): Promise<StayQuote> {
  const nights = nightsBetween(checkIn, checkOut);
  const supabase = await createClient();

  const [{ data: rooms }, { data: nightRows }] = await Promise.all([
    supabase
      .from("hotel_rooms")
      .select("id, name, base_price, currency, max_occupancy")
      .eq("hotel_id", hotelId)
      .eq("status", "published")
      .order("base_price"),
    supabase.rpc("hotel_availability", { p_hotel_id: hotelId, p_from: checkIn, p_days: nights }),
  ]);

  return {
    checkIn,
    checkOut,
    nights,
    rooms: (rooms ?? []).map((room) => {
      const base = Number(room.base_price);
      const roomNights = (nightRows ?? []).filter((n) => n.room_id === room.id);
      const tracked = roomNights.filter((n) => n.capacity !== null && n.available !== null);
      const stayPrice = roomNights.reduce(
        (sum, n) => sum + (n.price_override === null ? base : Number(n.price_override)),
        0
      );
      return {
        id: room.id,
        name: room.name,
        currency: room.currency,
        maxOccupancy: room.max_occupancy,
        nightlyRate: base,
        stayPricePerRoom: roomNights.length === nights ? stayPrice : base * nights,
        available: tracked.length > 0 ? Math.min(...tracked.map((n) => n.available as number)) : null,
      };
    }),
  };
}

export async function quoteStay(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<{ error: string } | { quote: StayQuote }> {
  if (!z.string().uuid().safeParse(hotelId).success || !isoDate.safeParse(checkIn).success || !isoDate.safeParse(checkOut).success) {
    return { error: "Pick valid dates." };
  }
  if (checkOut <= checkIn) return { error: "Check-out must be after check-in." };
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return { error: `Stays are limited to ${MAX_NIGHTS} nights.` };
  if (!(await requireBookingManager(hotelId))) return { error: "You don't have permission to create bookings for this hotel." };

  return { quote: await buildQuote(hotelId, checkIn, checkOut) };
}

const reservationSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomTypeId: z.string().uuid({ message: "Choose a room type." }),
    checkIn: isoDate,
    checkOut: isoDate,
    numRooms: z.coerce.number().int().min(1).max(20),
    adults: z.coerce.number().int().min(1, "At least one adult is required.").max(80),
    children: z.coerce.number().int().min(0).max(40),
    guestName: z.string().trim().min(2, "Enter the guest's full name.").max(120),
    guestPhone: z.string().trim().max(30).optional(),
    guestEmail: z.string().trim().email("Enter a valid email address.").max(160).optional(),
    paymentMethod: z.enum(OFFLINE_PAYMENT_METHODS, { message: "Choose a payment method." }),
    paymentStatus: z.enum(["paid", "unpaid"]),
    paymentReference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value ? value : undefined;
}

/**
 * A front-desk booking (walk-in, phone) for a named guest. Inserted straight
 * as 'confirmed' into the same hotel_bookings ledger online bookings use, so
 * its BEFORE INSERT allocator trigger holds the rooms immediately — an online
 * search for these dates sees them gone. 'confirmed' rather than the column
 * default 'pending' matters beyond display: the allocator only ever displaces
 * pending requests, so a guest the hotel itself promised a room to can't be
 * bumped later by an agency booking. If the rooms went in the seconds since
 * the quote, the trigger lands it as 'waitlisted' instead, and that outcome
 * is returned rather than reported as a success.
 */
export async function createReservation(formData: FormData): Promise<ReservationResult> {
  const parsed = reservationSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomTypeId: formData.get("roomTypeId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    numRooms: formData.get("numRooms"),
    adults: formData.get("adults"),
    children: formData.get("children"),
    guestName: formData.get("guestName")?.toString() ?? "",
    guestPhone: optionalText(formData, "guestPhone"),
    guestEmail: optionalText(formData, "guestEmail"),
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    paymentStatus: formData.get("paymentStatus"),
    paymentReference: optionalText(formData, "paymentReference"),
    notes: optionalText(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.checkIn < todayIso()) return { error: "Check-in can't be in the past." };
  if (nightsBetween(d.checkIn, d.checkOut) > MAX_NIGHTS) return { error: `Stays are limited to ${MAX_NIGHTS} nights.` };

  const profile = await requireBookingManager(d.hotelId);
  if (!profile) return { error: "You don't have permission to create bookings for this hotel." };

  const quote = await buildQuote(d.hotelId, d.checkIn, d.checkOut);
  const room = quote.rooms.find((r) => r.id === d.roomTypeId);
  if (!room) return { error: "Room type not found." };
  if (d.adults + d.children > room.maxOccupancy * d.numRooms) {
    return { error: `${room.name} holds up to ${room.maxOccupancy} guests per room.` };
  }
  if (room.available !== null && room.available < d.numRooms) {
    return {
      error:
        room.available <= 0
          ? `${room.name} is sold out for these dates.`
          : `Only ${room.available} ${room.name} left for these dates.`,
    };
  }

  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("hotel_bookings")
    .insert({
      hotel_id: d.hotelId,
      room_id: room.id,
      customer_id: profile.id,
      booked_by: profile.id,
      agency_id: null,
      source: "offline",
      status: "confirmed",
      check_in: d.checkIn,
      check_out: d.checkOut,
      num_rooms: d.numRooms,
      num_adults: d.adults,
      num_children: d.children,
      guest_details: [{ full_name: d.guestName, phone: d.guestPhone ?? null, email: d.guestEmail ?? null }],
      special_requests: d.notes ?? null,
      total_price: room.stayPricePerRoom * d.numRooms,
      currency: room.currency,
      payment_method: d.paymentMethod,
      paid_at: d.paymentStatus === "paid" ? new Date().toISOString() : null,
      payment_reference: d.paymentReference ?? null,
    })
    .select("id, status")
    .single();
  if (error || !booking) return { error: error?.message ?? "The booking could not be saved." };

  for (const path of ["", "/bookings", "/front-desk", "/rooms", `/rooms/${room.id}`]) {
    revalidatePath(`/manager/${d.hotelId}${path}`);
  }

  return {
    error: null,
    bookingId: booking.id,
    status: booking.status === "confirmed" ? "confirmed" : "waitlisted",
  };
}

/** Records payment on an offline booking that was left to pay at check-in. */
export async function markBookingPaid(formData: FormData): Promise<void> {
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const hotelId = z.string().uuid().safeParse(formData.get("hotelId"));
  if (!bookingId.success || !hotelId.success) return;
  if (!(await requireBookingManager(hotelId.data))) return;

  const supabase = await createClient();
  await supabase
    .from("hotel_bookings")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", bookingId.data)
    .eq("hotel_id", hotelId.data)
    .eq("source", "offline")
    .is("paid_at", null);

  revalidatePath(`/manager/${hotelId.data}/bookings`);
}
