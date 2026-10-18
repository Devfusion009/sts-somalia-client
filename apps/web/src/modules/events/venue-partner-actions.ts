"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { nextHallBookingMoves } from "@/modules/events/hall-transitions";
import { todayIso } from "@/modules/hotels/availability";
import { requireUser } from "@/lib/auth/session";
import { getMyVenuePartnerId } from "./venue-partner-queries";

export type ActionState = { error: string | null } | null;

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// Partner-facing venue statuses deliberately exclude 'published': a partner
// drafts and submits for review; only admins publish to the public catalog
// (same trust boundary hotels have — a listing goes live after staff eyes).
const venueSchema = z.object({
  name: z.string().min(2, "Enter the venue name."),
  city: z.string().min(1, "Enter the city."),
  tagline: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  capacitySeated: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  capacityStanding: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  sizeSqm: z.coerce.number().min(1).optional().or(z.literal("").transform(() => undefined)),
  eventTypes: z.string().optional(), // comma-separated
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default("USD"),
  priceUnit: z.enum(["per_event", "per_day", "per_hour", "per_person"]),
  status: z.enum(["draft", "pending_review"]),
});

function venueRow(d: z.infer<typeof venueSchema>) {
  return {
    name: d.name,
    city: d.city,
    tagline: d.tagline || null,
    description: d.description || null,
    address: d.address || null,
    capacity_seated: d.capacitySeated ?? null,
    capacity_standing: d.capacityStanding ?? null,
    size_sqm: d.sizeSqm ?? null,
    event_types: d.eventTypes ? d.eventTypes.split(",").map((t) => t.trim()).filter(Boolean) : [],
    base_price: d.basePrice,
    currency: d.currency.toUpperCase(),
    price_unit: d.priceUnit,
    status: d.status,
  };
}

function venueInput(formData: FormData) {
  return Object.fromEntries(
    ["name", "city", "tagline", "description", "address", "capacitySeated", "capacityStanding", "sizeSqm", "eventTypes", "basePrice", "currency", "priceUnit", "status"].map(
      (k) => [k, formData.get(k) ?? ""]
    )
  );
}

export async function createMyVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const partnerId = await getMyVenuePartnerId(profile.id);
  if (!partnerId) return { error: "No active venue partner membership found." };

  const parsed = venueSchema.safeParse(venueInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_venues")
    .insert({ ...venueRow(parsed.data), slug: slugify(parsed.data.name), partner_id: partnerId });
  if (error) return { error: error.message };
  revalidatePath("/venue/venues");
  return { error: null };
}

export async function updateMyVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const partnerId = await getMyVenuePartnerId(profile.id);
  if (!partnerId) return { error: "No active venue partner membership found." };

  const venueId = String(formData.get("venueId"));
  const parsed = venueSchema.safeParse(venueInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // Once admin publishes, a partner edit must not silently un-publish —
  // only touch status while the venue is still in the partner's hands.
  const { data: current } = await supabase
    .from("event_venues")
    .select("status")
    .eq("id", venueId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (!current) return { error: "Venue not found." };

  const row = venueRow(parsed.data);
  const update = ["draft", "pending_review"].includes(current.status) ? row : { ...row, status: undefined };
  const { error } = await supabase
    .from("event_venues")
    .update(update)
    .eq("id", venueId)
    .eq("partner_id", partnerId);
  if (error) return { error: error.message };
  revalidatePath("/venue/venues");
  return { error: null };
}

const bookingStatuses = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;

/** Venue-side booking decision — the events mirror of the hotel partner's updateBookingStatus. */
export async function updateVenueBookingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const partnerId = await getMyVenuePartnerId(profile.id);
  if (!partnerId) return { error: "No active venue partner membership found." };

  const bookingId = String(formData.get("bookingId"));
  const status = String(formData.get("status"));
  if (!bookingStatuses.includes(status as (typeof bookingStatuses)[number])) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("hall_bookings")
    .select("id, status, start_date, end_date, price")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking not found." };
  if (!(nextHallBookingMoves(booking, todayIso()) as string[]).includes(status)) {
    return { error: `A ${booking.status.replace(/_/g, " ")} booking can't be changed to ${status.replace(/_/g, " ")}.` };
  }
  if (status === "confirmed" && Number(booking.price) <= 0) return { error: "Set the price before confirming." };

  // RLS restricts the update to bookings on this partner's own venues; the
  // explicit venue check just turns a silent no-op into a real error.
  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({ status: status as (typeof bookingStatuses)[number] })
    .eq("id", bookingId)
    .eq("status", booking.status)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "Booking not found." };
  revalidatePath("/venue/bookings");
  return { error: null };
}
