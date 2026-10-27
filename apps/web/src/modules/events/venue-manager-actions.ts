"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { todayIso } from "@/modules/hotels/availability";
import { repriceQuotedOrder } from "@/modules/orders/helpers";
import { uploadImages, removeImage, setCoverImage, type GalleryUploadState } from "@/modules/admin/property-gallery-actions";
import { TARGETS } from "@/modules/admin/gallery-targets";
import { getDeskVenue, getMyManagedVenue, hasVenuePermission, type ManagedVenue } from "./venue-manager-queries";
import { venueCapacity } from "@sts/shared-types";
import type { VenueManagerPermission } from "./venue-manager-permissions";
import { OFFLINE_PAYMENT_METHODS, hallSlotLabel, type VenueBookingResult } from "./venue-desk-types";
import { requireVenueAccess, revalidateVenueDesk } from "./venue-access";
import { nextHallBookingMoves } from "./hall-transitions";
import { invalidateCache } from "@/lib/redis";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");
const clockTime = z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.");

/** The tenant + permission gate every action here runs first. */
async function requireVenuePermission(
  venueId: string,
  permission: VenueManagerPermission
): Promise<{ profileId: string; managed: ManagedVenue } | null> {
  if (!z.string().uuid().safeParse(venueId).success) return null;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed || !hasVenuePermission(managed, permission)) return null;
  return { profileId: profile.id, managed };
}

function revalidateDesk(venueId: string) {
  revalidateVenueDesk(venueId);
}

/**
 * Desk actions open to a platform admin and to the venue's manager with the
 * permission. Only a guard's own one-line message (P0001) reaches the screen.
 */
async function requireDesk(venueId: string, permission: VenueManagerPermission) {
  if (!z.string().uuid().safeParse(venueId).success) return null;
  return requireVenueAccess(venueId, permission);
}

function dbMessage(error: { code?: string; message: string } | null, fallback: string) {
  return error?.code === "P0001" ? error.message : fallback;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value ? value : undefined;
}

const bookingSchema = z
  .object({
    venueId: z.string().uuid(),
    eventType: z.string().trim().min(2, "Enter the event type.").max(60),
    eventName: z.string().trim().max(120).optional(),
    startDate: isoDate,
    endDate: isoDate,
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
    expectedGuests: z.coerce.number().int().min(1, "Enter the number of guests.").max(20000),
    contactName: z.string().trim().min(2, "Enter the client's full name.").max(120),
    contactPhone: z.string().trim().min(5, "Enter the client's phone number.").max(30),
    contactEmail: z.string().trim().email("Enter a valid email address.").max(160).optional(),
    price: z.coerce.number().positive("Enter the agreed price.").max(10_000_000),
    paymentMethod: z.enum(OFFLINE_PAYMENT_METHODS, { message: "Choose a payment method." }),
    paymentStatus: z.enum(["paid", "unpaid"]),
    paymentReference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "The end date can't be before the start date.", path: ["endDate"] })
  .refine((d) => !d.startTime || !d.endTime || d.startDate !== d.endDate || d.endTime > d.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

/**
 * A desk booking (walk-in, phone, WhatsApp) for a named client. Inserted as
 * 'confirmed' into the same hall_bookings ledger online requests use, so the
 * venue's allocator holds the slot immediately — online availability sees it
 * gone, and no agency request can displace it (only pending online requests
 * are displaceable). If the slot went in the seconds since the pre-check, the
 * trigger refuses the insert and its message is returned.
 */
export async function createVenueBooking(formData: FormData): Promise<VenueBookingResult> {
  const parsed = bookingSchema.safeParse({
    venueId: formData.get("venueId"),
    eventType: formData.get("eventType")?.toString() ?? "",
    eventName: optionalText(formData, "eventName"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || formData.get("startDate"),
    startTime: optionalText(formData, "startTime"),
    endTime: optionalText(formData, "endTime"),
    expectedGuests: formData.get("expectedGuests"),
    contactName: formData.get("contactName")?.toString() ?? "",
    contactPhone: formData.get("contactPhone")?.toString() ?? "",
    contactEmail: optionalText(formData, "contactEmail"),
    price: formData.get("price"),
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    paymentStatus: formData.get("paymentStatus"),
    paymentReference: optionalText(formData, "paymentReference"),
    notes: optionalText(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.startDate < todayIso()) return { error: "The event date can't be in the past." };

  const gate = await requireDesk(d.venueId, "bookings");
  if (!gate) return { error: "You don't have permission to create bookings for this venue." };
  const venue = await getDeskVenue(d.venueId);
  if (!venue) return { error: "Venue not found." };

  const capacity = venueCapacity(venue);
  if (capacity && d.expectedGuests > capacity) {
    return { error: `This venue holds up to ${capacity} guests.` };
  }

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("venue_slot_available", {
    p_venue_id: d.venueId,
    p_start: d.startDate,
    p_end: d.endDate,
    p_from: d.startTime,
    p_to: d.endTime,
  });
  if (available === false) return { error: "This venue is already booked or blocked for that slot." };

  const { data: booking, error } = await supabase
    .from("hall_bookings")
    .insert({
      venue_id: d.venueId,
      customer_id: gate.profileId,
      booked_by: gate.profileId,
      source: "offline",
      status: "confirmed",
      event_type: d.eventType,
      event_name: d.eventName ?? null,
      start_date: d.startDate,
      end_date: d.endDate,
      start_time: d.startTime ?? null,
      end_time: d.endTime ?? null,
      expected_guests: d.expectedGuests,
      setup_requirements: d.notes ?? null,
      contact_name: d.contactName,
      contact_phone: d.contactPhone,
      contact_email: d.contactEmail ?? null,
      price: d.price,
      currency: venue.currency,
      payment_method: d.paymentMethod,
      paid_at: d.paymentStatus === "paid" ? new Date().toISOString() : null,
      payment_reference: d.paymentReference ?? null,
    })
    .select("id, booking_ref, status")
    .single();
  if (error || !booking) return { error: dbMessage(error, "The booking could not be saved.") };

  revalidateDesk(d.venueId);
  return {
    error: null,
    bookingId: booking.id,
    bookingRef: booking.booking_ref,
    status: booking.status === "confirmed" ? "confirmed" : "waitlisted",
  };
}

/** Pre-flight for the booking form: is this slot free right now? */
export async function checkVenueSlot(
  venueId: string,
  startDate: string,
  endDate: string,
  startTime?: string,
  endTime?: string
): Promise<{ available: boolean } | { error: string }> {
  if (!isoDate.safeParse(startDate).success || !isoDate.safeParse(endDate).success) return { error: "Pick valid dates." };
  if (endDate < startDate) return { error: "The end date can't be before the start date." };
  if (!(await requireDesk(venueId, "bookings"))) return { error: "Not permitted." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("venue_slot_available", {
    p_venue_id: venueId,
    p_start: startDate,
    p_end: endDate,
    p_from: clockTime.safeParse(startTime).success ? startTime : undefined,
    p_to: clockTime.safeParse(endTime).success ? endTime : undefined,
  });
  if (error) return { error: "Availability could not be checked." };
  return { available: !!data };
}

const statusSchema = z.object({
  venueId: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show", "refunded"]),
});

/**
 * Confirm, decline, complete or mark no-show — only the moves the booking's
 * status and dates allow (nextHallBookingMoves, enforced again by
 * hall_bookings_status_guard). Confirming a waitlisted request re-runs the
 * allocator and fails with its message when the slot is still taken. The
 * database closes an unpaid order on decline and opens the refund when a
 * paid booking is cancelled.
 */
export async function setHallBookingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = statusSchema.safeParse({
    venueId: formData.get("venueId"),
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid status." };

  let access: Awaited<ReturnType<typeof requireVenueAccess>>;
  try {
    access = await requireVenueAccess(parsed.data.venueId, "bookings");
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  if (!access) return { error: "You don't have permission to manage bookings for this venue." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("hall_bookings")
    .select("id, status, start_date, end_date, price")
    .eq("id", parsed.data.bookingId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!booking) return { error: "Booking not found." };
  if (!nextHallBookingMoves(booking, todayIso(), access.isAdmin).includes(parsed.data.status)) {
    return { error: `A ${booking.status.replace(/_/g, " ")} booking can't be changed to ${parsed.data.status.replace(/_/g, " ")}.` };
  }
  if (parsed.data.status === "confirmed" && Number(booking.price) <= 0) return { error: "Set the price before confirming." };

  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId)
    .eq("status", booking.status)
    .select("id")
    .maybeSingle();
  if (error) return { error: dbMessage(error, "The booking could not be updated.") };
  if (!updated) return { error: "This booking was just changed. Refresh and try again." };

  revalidateDesk(parsed.data.venueId);
  return { error: null };
}

const priceSchema = z.object({
  venueId: z.string().uuid(),
  bookingId: z.string().uuid(),
  price: z.coerce.number().min(0, "Enter a valid price.").max(10_000_000),
});

/** Quote or adjust a request's price; an unpaid order follows it. */
export async function quoteHallBookingPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = priceSchema.safeParse({
    venueId: formData.get("venueId"),
    bookingId: formData.get("bookingId"),
    price: formData.get("price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!(await requireVenueAccess(parsed.data.venueId, "bookings"))) {
    return { error: "You don't have permission to manage bookings for this venue." };
  }

  // The order total follows the quote only while nothing is paid; after a
  // payment the two would drift apart and the balance due would be wrong.
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("order_items")
    .select("id, order:order_id (id, status, agency_id)")
    .eq("hall_booking_id", parsed.data.bookingId)
    .maybeSingle();
  if (item?.order && item.order.status !== "pending_payment" && item.order.status !== "held") {
    return { error: "Only unpaid bookings can be repriced." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({ price: parsed.data.price })
    .eq("id", parsed.data.bookingId)
    .eq("venue_id", parsed.data.venueId)
    .in("status", ["pending", "waitlisted"])
    .select("id")
    .maybeSingle();
  if (error) return { error: "Could not save the price." };
  if (!updated) return { error: "Only an open request can be repriced." };

  if (item?.order) {
    await repriceQuotedOrder(admin, item.order, item.id, "hall", parsed.data.price);
  }

  revalidateDesk(parsed.data.venueId);
  return { error: null };
}

/** Records payment on a desk booking left to pay later. */
export async function markHallBookingPaid(formData: FormData): Promise<void> {
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const venueId = String(formData.get("venueId") ?? "");
  if (!bookingId.success) return;
  if (!(await requireVenueAccess(venueId, "bookings"))) return;

  const supabase = await createClient();
  await supabase
    .from("hall_bookings")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", bookingId.data)
    .eq("venue_id", venueId)
    .eq("source", "offline")
    .is("paid_at", null);

  revalidateDesk(venueId);
}

const rescheduleSchema = z
  .object({
    venueId: z.string().uuid(),
    bookingId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "The end date can't be before the start date.", path: ["endDate"] })
  .refine((d) => !d.startTime || !d.endTime || d.startDate !== d.endDate || d.endTime > d.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

/**
 * Moves a live booking to a new slot — the follow-through on a client's
 * change request. The slot trigger re-runs the allocator and refuses a slot
 * that is taken or blocked; the price is left as agreed.
 */
export async function rescheduleHallBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = rescheduleSchema.safeParse({
    venueId: formData.get("venueId"),
    bookingId: formData.get("bookingId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || formData.get("startDate"),
    startTime: optionalText(formData, "startTime"),
    endTime: optionalText(formData, "endTime"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.startDate < todayIso()) return { error: "The new date can't be in the past." };
  if (Boolean(d.startTime) !== Boolean(d.endTime)) return { error: "Enter both times or neither." };

  if (!(await requireDesk(d.venueId, "bookings"))) {
    return { error: "You don't have permission to manage bookings for this venue." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({
      start_date: d.startDate,
      end_date: d.endDate,
      start_time: d.startTime ?? null,
      end_time: d.endTime ?? null,
    })
    .eq("id", d.bookingId)
    .eq("venue_id", d.venueId)
    .in("status", ["pending", "waitlisted", "confirmed"])
    .gte("end_date", todayIso())
    .select("id, source, customer_id, venue:event_venues(name)")
    .maybeSingle();
  if (error) return { error: dbMessage(error, "The booking could not be moved.") };
  if (!updated) return { error: "Only an upcoming booking can be moved." };

  // An online client learns of the new slot; a desk client was on the phone.
  if (updated.source === "online" && updated.customer_id) {
    await createAdminClient()
      .from("notifications")
      .insert({
        profile_id: updated.customer_id,
        type: "booking_rescheduled",
        title: `Booking moved — ${updated.venue?.name ?? "venue"}`,
        body: hallSlotLabel({ start_date: d.startDate, end_date: d.endDate, start_time: d.startTime ?? null, end_time: d.endTime ?? null }),
        data: { hall_booking_id: d.bookingId },
      });
  }

  revalidateDesk(d.venueId);
  return { error: null };
}

const notesSchema = z.object({
  venueId: z.string().uuid(),
  bookingId: z.string().uuid(),
  notes: z.string().trim().max(2000, "Notes are limited to 2,000 characters."),
});

/** Staff-only notes on a booking (setup, catering, contacts); never shown to the client. */
export async function saveHallBookingNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = notesSchema.safeParse({
    venueId: formData.get("venueId"),
    bookingId: formData.get("bookingId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await requireDesk(parsed.data.venueId, "bookings"))) {
    return { error: "You don't have permission to manage bookings for this venue." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({ admin_notes: parsed.data.notes || null })
    .eq("id", parsed.data.bookingId)
    .eq("venue_id", parsed.data.venueId)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { error: "The notes could not be saved." };

  revalidateDesk(parsed.data.venueId);
  return { error: null };
}

const blockSchema = z
  .object({
    venueId: z.string().uuid(),
    dateStart: isoDate,
    dateEnd: isoDate,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.dateEnd >= d.dateStart, { message: "The end date can't be before the start date.", path: ["dateEnd"] });

export async function blockVenueDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = blockSchema.safeParse({
    venueId: formData.get("venueId"),
    dateStart: formData.get("dateStart"),
    dateEnd: formData.get("dateEnd") || formData.get("dateStart"),
    reason: optionalText(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.dateStart < todayIso()) return { error: "Past dates can't be blocked." };

  const gate = await requireDesk(parsed.data.venueId, "calendar");
  if (!gate) return { error: "You don't have permission to block dates for this venue." };

  const supabase = await createClient();
  const { error } = await supabase.from("venue_blocked_dates").insert({
    venue_id: parsed.data.venueId,
    date_start: parsed.data.dateStart,
    date_end: parsed.data.dateEnd,
    reason: parsed.data.reason ?? null,
    created_by: gate.profileId,
  });
  if (error) return { error: dbMessage(error, "The dates could not be blocked.") };

  revalidateDesk(parsed.data.venueId);
  return { error: null };
}

export async function unblockVenueDates(formData: FormData): Promise<void> {
  const blockId = z.string().uuid().safeParse(formData.get("blockId"));
  const venueId = String(formData.get("venueId") ?? "");
  if (!blockId.success) return;
  if (!(await requireDesk(venueId, "calendar"))) return;

  const supabase = await createClient();
  await supabase.from("venue_blocked_dates").delete().eq("id", blockId.data).eq("venue_id", venueId);
  revalidateDesk(venueId);
}

const profileSchema = z.object({
  venueId: z.string().uuid(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  contactEmail: z.string().email("Enter a valid contact email.").or(z.literal("")).optional(),
  policies: z.string().max(4000).optional(),
});

/**
 * The manager's slice of the venue row: operational fields only. Name,
 * slug, status, pricing and partner stay with STS and the owning partner —
 * the RLS policy behind this is row-level, so this column list IS the
 * boundary; keep it narrow.
 */
export async function updateVenueProfileAsManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    venueId: formData.get("venueId"),
    tagline: formData.get("tagline") || undefined,
    description: formData.get("description") || undefined,
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    policies: formData.get("policies") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const gate = await requireVenuePermission(parsed.data.venueId, "profile");
  if (!gate) return { error: "You don't have permission to edit this venue's profile." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_venues")
    .update({
      tagline: parsed.data.tagline ?? null,
      description: parsed.data.description ?? null,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      contact_email: parsed.data.contactEmail || null,
      policies: parsed.data.policies ?? null,
    })
    .eq("id", parsed.data.venueId);
  if (error) return { error: "The profile could not be saved." };

  await invalidateCache("events");
  revalidatePath(`/manager/venues/${parsed.data.venueId}/profile`);
  revalidatePath("/events", "layout");
  return { error: null };
}

/** Gallery actions bound to the 'photos' permission; storage + row writes run under the manager's RLS. */
export async function uploadVenueImagesAsManager(_prev: ActionState, formData: FormData): Promise<GalleryUploadState> {
  const venueId = String(formData.get("id") ?? "");
  if (!(await requireVenuePermission(venueId, "photos"))) return { error: "You don't have permission to manage photos." };
  const result = await uploadImages(TARGETS.venue, formData);
  revalidatePath(`/manager/venues/${venueId}/photos`);
  return result;
}

export async function removeVenueImageAsManager(formData: FormData): Promise<void> {
  const venueId = String(formData.get("id") ?? "");
  if (!(await requireVenuePermission(venueId, "photos"))) return;
  await removeImage(TARGETS.venue, formData);
  revalidatePath(`/manager/venues/${venueId}/photos`);
}

export async function setVenueCoverImageAsManager(formData: FormData): Promise<void> {
  const venueId = String(formData.get("id") ?? "");
  if (!(await requireVenuePermission(venueId, "photos"))) return;
  await setCoverImage(TARGETS.venue, formData);
  revalidatePath(`/manager/venues/${venueId}/photos`);
}
