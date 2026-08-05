"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { createOrderForBooking, getActiveAgencyId } from "@/modules/orders/helpers";

export type ActionState = { error: string | null } | null;

const bookingSchema = z.object({
  venueId: z.string().uuid(),
  eventType: z.string().min(2, "Select the type of event."),
  eventName: z.string().max(200).optional(),
  eventDate: z.string().min(1, "Choose the event date."),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  expectedGuests: z.coerce.number().int().min(1, "Enter the expected number of guests."),
  setupRequirements: z.string().max(2000).optional(),
});

export async function createHallBooking(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = bookingSchema.safeParse({
    venueId: formData.get("venueId"),
    eventType: formData.get("eventType"),
    eventName: formData.get("eventName")?.toString().trim() || undefined,
    eventDate: formData.get("eventDate"),
    startTime: formData.get("startTime")?.toString() || undefined,
    endTime: formData.get("endTime")?.toString() || undefined,
    expectedGuests: formData.get("expectedGuests"),
    setupRequirements: formData.get("setupRequirements")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const eventDate = new Date(`${d.eventDate}T00:00:00`);
  if (Number.isNaN(eventDate.getTime()) || eventDate < new Date(new Date().toDateString())) {
    return { error: "The event date must be in the future." };
  }

  const user = await requireUser();
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("event_venues")
    .select("*")
    .eq("id", d.venueId)
    .eq("status", "published")
    .maybeSingle();
  if (!venue) return { error: "This venue is no longer available." };

  if (venue.capacity_standing && d.expectedGuests > venue.capacity_standing) {
    return {
      error: `This venue hosts up to ${venue.capacity_standing} guests — please adjust the guest count or contact us for alternatives.`,
    };
  }

  // Soft availability check: one confirmed/pending event per venue per day.
  const { data: clash } = await supabase
    .from("hall_bookings")
    .select("id")
    .eq("venue_id", venue.id)
    .eq("event_date", d.eventDate)
    .in("status", ["pending", "confirmed"])
    .limit(1)
    .maybeSingle();
  if (clash) {
    return { error: "This date is already reserved — contact us for alternatives." };
  }

  const agencyId = await getActiveAgencyId(supabase, user.id);
  const { data: booking, error: bookingError } = await supabase
    .from("hall_bookings")
    .insert({
      venue_id: venue.id,
      customer_id: user.id,
      booked_by: user.id,
      agency_id: agencyId,
      event_type: d.eventType,
      event_name: d.eventName ?? null,
      event_date: d.eventDate,
      start_time: d.startTime ?? null,
      end_time: d.endTime ?? null,
      expected_guests: d.expectedGuests,
      setup_requirements: d.setupRequirements ?? null,
      price: venue.base_price,
      currency: venue.currency,
    })
    .select()
    .single();
  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking. Please try again." };
  }

  const order = await createOrderForBooking(supabase, {
    customerId: user.id,
    bookedBy: user.id,
    agencyId,
    currency: venue.currency,
    itemType: "hall",
    price: Number(venue.base_price),
    hallBookingId: booking.id,
  });

  redirect(`/checkout/${order.id}`);
}
