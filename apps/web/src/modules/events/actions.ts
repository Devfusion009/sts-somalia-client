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

const bookingSchema = z.object({
  venueId: z.string().uuid(),
  eventType: z.string().min(2, "Select the type of event."),
  eventName: z.string().max(200).optional(),
  startDate: z.string().min(1, "Choose a start date."),
  endDate: z.string().min(1, "Choose an end date."),
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
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime")?.toString() || undefined,
    endTime: formData.get("endTime")?.toString() || undefined,
    expectedGuests: formData.get("expectedGuests"),
    setupRequirements: formData.get("setupRequirements")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const startDate = new Date(`${d.startDate}T00:00:00`);
  const endDate = new Date(`${d.endDate}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || startDate < new Date(new Date().toDateString())) {
    return { error: "The start date must be in the future." };
  }
  if (Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return { error: "The end date can't be before the start date." };
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

  // Availability check: any confirmed/pending booking whose [start, end] range
  // overlaps the requested one blocks the slot. Two ranges overlap iff
  // existing.start <= requested.end AND existing.end >= requested.start.
  const { data: clash } = await supabase
    .from("hall_bookings")
    .select("id")
    .eq("venue_id", venue.id)
    .lte("start_date", d.endDate)
    .gte("end_date", d.startDate)
    .in("status", ["pending", "confirmed"])
    .limit(1)
    .maybeSingle();
  if (clash) {
    return { error: "These dates overlap an existing booking — contact us for alternatives." };
  }

  const agencyId = await getActiveAgencyId(supabase, user.id);
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "hall");
  if (!access.ok) return { error: access.message };
  const agencyCustomerId = await resolveBookedForCustomer(supabase, agencyId, formData);

  // Per-person venues price by headcount: estimate = rate × expected guests.
  // The stored price is an ESTIMATE the venue confirms (admin adjusts it via
  // updateHallBookingPrice before confirming) — which is also why these
  // requests skip checkout below.
  const estimatedPrice =
    venue.price_unit === "per_person"
      ? Number(venue.base_price) * d.expectedGuests
      : Number(venue.base_price);

  const { data: booking, error: bookingError } = await supabase
    .from("hall_bookings")
    .insert({
      venue_id: venue.id,
      customer_id: user.id,
      booked_by: user.id,
      agency_id: agencyId,
      event_type: d.eventType,
      event_name: d.eventName ?? null,
      start_date: d.startDate,
      end_date: d.endDate,
      start_time: d.startTime ?? null,
      end_time: d.endTime ?? null,
      expected_guests: d.expectedGuests,
      setup_requirements: d.setupRequirements ?? null,
      price: estimatedPrice,
      currency: venue.currency,
    })
    .select()
    .single();
  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking. Please try again." };
  }

  // Org-level email/WhatsApp to the owning partner (the in-app bell already
  // reaches every partner staff member via the hall_bookings insert
  // trigger). Best-effort — skipped entirely for STS-managed venues
  // (partner_id null).
  if (venue.partner_id) {
    const { data: venuePartner } = await supabase
      .from("venue_partners")
      .select("contact_email, contact_phone")
      .eq("id", venue.partner_id)
      .maybeSingle();
    if (venuePartner) {
      void notifyPartnerOfBooking({
        partnerEmail: venuePartner.contact_email,
        partnerPhone: venuePartner.contact_phone,
        propertyName: venue.name,
        summary: `${d.eventType}, ${d.expectedGuests} guests, ${d.startDate}${d.endDate !== d.startDate ? ` → ${d.endDate}` : ""}`,
      }).catch(() => {});
    }
  }

  const order = await createOrderForBooking(supabase, {
    customerId: user.id,
    bookedBy: user.id,
    agencyId,
    agencyCustomerId,
    currency: venue.currency,
    itemType: "hall",
    price: estimatedPrice,
    hallBookingId: booking.id,
  });

  // Per-person and price-on-request venues confirm the FINAL price before the
  // booking completes — charging the estimate up front would mean refund
  // gymnastics whenever the venue quotes differently. The request lands in
  // the admin queue; the customer pays from their booking page once the
  // price is confirmed. Fixed-price venues keep the pay-now flow.
  if (isDeskBooking(formData, agencyId)) {
    return { error: null, destination: deskOrderPath(order.id), orderId: order.id };
  }

  if (venue.price_unit === "per_person" || Number(venue.base_price) === 0) {
    redirect(`/account/bookings/${order.id}?requested=1`);
  }

  redirect(`/checkout/${order.id}`);
}
