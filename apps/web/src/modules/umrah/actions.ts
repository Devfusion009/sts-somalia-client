"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  assertAgencyCanBookProduct,
  createOrderForBooking,
  deskOrderPath,
  getActiveAgencyId,
  isDeskBooking,
} from "@/modules/orders/helpers";
import { resolveBookedForCustomer } from "@/modules/agencies/booked-for";
import type { ActionState } from "@/lib/auth/actions";

const pilgrimSchema = z.object({
  full_name: z.string().min(2, "Enter the pilgrim's full name."),
  gender: z.enum(["male", "female"]),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  mahram_name: z.string().optional(),
  mahram_relation: z.string().optional(),
});

const bookingSchema = z.object({
  departure_id: z.string().uuid("Select a departure date."),
  num_pilgrims: z.coerce.number().int().min(1, "At least one pilgrim is required."),
  room_sharing: z.coerce.number().int().min(1).max(12).optional(),
  special_requests: z.string().optional(),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length ? str : undefined;
}

export async function createUmrahBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const existing = await getCurrentProfile();
  // Signed-out visitors go through login and come back to the packages list.
  if (!existing) redirect(`/login?redirect_to=${encodeURIComponent("/umrah")}`);
  const profile = existing;

  const parsedBooking = bookingSchema.safeParse({
    departure_id: formData.get("departure_id"),
    num_pilgrims: formData.get("num_pilgrims"),
    room_sharing: emptyToUndefined(formData.get("room_sharing")),
    special_requests: formData.get("special_requests"),
  });
  if (!parsedBooking.success) {
    return { error: parsedBooking.error.issues[0].message };
  }
  const { departure_id, num_pilgrims, room_sharing, special_requests } = parsedBooking.data;

  const pilgrims: z.infer<typeof pilgrimSchema>[] = [];
  for (let i = 0; i < num_pilgrims; i++) {
    const parsedPilgrim = pilgrimSchema.safeParse({
      full_name: formData.get(`pilgrim_${i}_full_name`),
      gender: formData.get(`pilgrim_${i}_gender`),
      date_of_birth: emptyToUndefined(formData.get(`pilgrim_${i}_date_of_birth`)),
      nationality: emptyToUndefined(formData.get(`pilgrim_${i}_nationality`)),
      passport_number: emptyToUndefined(formData.get(`pilgrim_${i}_passport_number`)),
      passport_expiry: emptyToUndefined(formData.get(`pilgrim_${i}_passport_expiry`)),
      mahram_name: emptyToUndefined(formData.get(`pilgrim_${i}_mahram_name`)),
      mahram_relation: emptyToUndefined(formData.get(`pilgrim_${i}_mahram_relation`)),
    });
    if (!parsedPilgrim.success) {
      return { error: `Pilgrim ${i + 1}: ${parsedPilgrim.error.issues[0].message}` };
    }
    pilgrims.push(parsedPilgrim.data);
  }

  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "umrah");
  if (!access.ok) return { error: access.message };
  const agencyCustomerId = await resolveBookedForCustomer(supabase, agencyId, formData);
  // Agents may reserve without paying; the hold expires like any other.
  const hold = Boolean(agencyId) && formData.get("intent") === "hold";

  // Booking and pilgrims are written in one transaction, priced in SQL from
  // the rate card / departure / package, and refused once sales close. The
  // insert trigger re-checks seats under a row lock on the departure.
  const { data: bookingId, error: bookingError } = await supabase.rpc("create_umrah_group_booking", {
    p_departure_id: departure_id,
    p_num_pilgrims: num_pilgrims,
    p_room_sharing: room_sharing ?? 0,
    p_special_requests: special_requests ?? "",
    p_pilgrims: pilgrims.map((pilgrim) => ({
      full_name: pilgrim.full_name,
      gender: pilgrim.gender,
      date_of_birth: pilgrim.date_of_birth ?? null,
      nationality: pilgrim.nationality ?? null,
      passport_number: pilgrim.passport_number ?? null,
      passport_expiry: pilgrim.passport_expiry ?? null,
      mahram_name: pilgrim.mahram_name ?? null,
      mahram_relation: pilgrim.mahram_relation ?? null,
    })),
    p_agency_id: agencyId ?? undefined,
  });
  if (bookingError || !bookingId) {
    return { error: groupBookingErrorMessage(bookingError?.message) };
  }

  const { data: booking } = await supabase
    .from("umrah_bookings")
    .select("id, total_price, currency")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Could not create the booking." };

  let order;
  try {
    order = await createOrderForBooking(supabase, {
      customerId: profile.id,
      bookedBy: profile.id,
      agencyId,
      agencyCustomerId,
      currency: booking.currency,
      itemType: "umrah",
      price: Number(booking.total_price),
      umrahBookingId: booking.id,
      hold,
    });
  } catch (err) {
    // Undo the booking so its seats are not held by a booking with no order.
    await supabase.from("umrah_bookings").delete().eq("id", booking.id);
    return { error: err instanceof Error ? err.message : "Could not create the order." };
  }

  if (isDeskBooking(formData, agencyId)) {
    return { error: null, destination: deskOrderPath(order.id), orderId: order.id };
  }

  redirect(`/checkout/${order.id}`);
}

/** Maps create_umrah_group_booking's raise messages to one plain line. */
function groupBookingErrorMessage(message: string | undefined) {
  if (!message) return "Could not create the booking.";
  if (message.includes("not enough seats left")) return "Not enough seats left on this departure.";
  if (message.includes("bookings for this departure are closed")) return "Bookings for this departure are closed.";
  if (message.includes("select a room sharing option")) return "Select a room sharing option.";
  if (message.includes("departure not found")) return "That departure could not be found.";
  if (message.includes("full name")) return "Enter each pilgrim's full name.";
  if (message.includes("do not match")) return "Add details for every pilgrim.";
  return "Could not create the booking.";
}
