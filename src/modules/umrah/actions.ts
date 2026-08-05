"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderForBooking, getActiveAgencyId } from "@/modules/orders/helpers";
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
    special_requests: formData.get("special_requests"),
  });
  if (!parsedBooking.success) {
    return { error: parsedBooking.error.issues[0].message };
  }
  const { departure_id, num_pilgrims, special_requests } = parsedBooking.data;

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

  const { data: departure, error: departureError } = await supabase
    .from("umrah_package_departures")
    .select("id, package_id, total_seats, booked_seats, price_override, umrah_packages(base_price, currency, status)")
    .eq("id", departure_id)
    .maybeSingle();

  if (departureError || !departure || departure.umrah_packages?.status !== "published") {
    return { error: "That departure could not be found." };
  }

  const seatsLeft = departure.total_seats - departure.booked_seats;
  if (num_pilgrims > seatsLeft) {
    return { error: `Only ${seatsLeft} seat(s) left on this departure.` };
  }

  const unitPrice = departure.price_override ?? departure.umrah_packages.base_price;
  const totalPrice = unitPrice * num_pilgrims;
  const currency = departure.umrah_packages.currency;
  const agencyId = await getActiveAgencyId(supabase, profile.id);

  const { data: booking, error: bookingError } = await supabase
    .from("umrah_bookings")
    .insert({
      package_id: departure.package_id,
      departure_id: departure.id,
      customer_id: profile.id,
      booked_by: profile.id,
      agency_id: agencyId,
      num_pilgrims,
      total_price: totalPrice,
      currency,
      special_requests: special_requests ?? null,
    })
    .select()
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking." };
  }

  const { error: pilgrimsError } = await supabase.from("umrah_pilgrims").insert(
    pilgrims.map((pilgrim) => ({
      booking_id: booking.id,
      full_name: pilgrim.full_name,
      gender: pilgrim.gender,
      date_of_birth: pilgrim.date_of_birth ?? null,
      nationality: pilgrim.nationality ?? null,
      passport_number: pilgrim.passport_number ?? null,
      passport_expiry: pilgrim.passport_expiry ?? null,
      mahram_name: pilgrim.mahram_name ?? null,
      mahram_relation: pilgrim.mahram_relation ?? null,
    }))
  );

  if (pilgrimsError) {
    return { error: pilgrimsError.message };
  }

  // Customers have no RLS UPDATE grant on umrah_package_departures (only
  // admins do), so this narrow, validated increment goes through the
  // service-role client. Everything else in this action stays on the
  // RLS-scoped client.
  await createAdminClient()
    .from("umrah_package_departures")
    .update({ booked_seats: departure.booked_seats + num_pilgrims })
    .eq("id", departure.id);

  let order;
  try {
    order = await createOrderForBooking(supabase, {
      customerId: profile.id,
      bookedBy: profile.id,
      agencyId,
      currency,
      itemType: "umrah",
      price: totalPrice,
      umrahBookingId: booking.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the order." };
  }

  redirect(`/checkout/${order.id}`);
}
