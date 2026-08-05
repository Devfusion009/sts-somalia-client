"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId } from "@/modules/hotels/partner-queries";
import type { ActionState } from "@/lib/auth/actions";

const LISTING_STATUSES = ["draft", "pending_review", "published", "suspended"] as const;

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

// Checked via direct membership lookup, not profile.role: a user approved
// for more than one program only has one role value on their profile
// (whichever was approved last). Also: requireUser()'s internal redirect()
// must not run inside a try/catch that swallows it (as requireRole() calls
// used to be here) — Next.js redirects throw a special signal that a
// generic `catch (e) { return { error: e.message } }` would otherwise
// display as a literal "NEXT_REDIRECT" error instead of navigating.
async function requirePartnerId() {
  const profile = await requireUser();
  const partnerId = await getMyPartnerId(profile.id);
  if (!partnerId) {
    throw new Error("No active hotel partner account found for this user.");
  }
  return partnerId;
}

const hotelSchema = z.object({
  name: z.string().min(2, "Enter a hotel name."),
  description: z.string().optional(),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(1, "Enter a city."),
  countryCode: z.string().min(2, "Enter a country code.").max(2),
  status: z.enum(LISTING_STATUSES),
});

export async function createHotel(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let partnerId: string;
  try {
    partnerId = await requirePartnerId();
  } catch (e) {
    // requireUser() inside requirePartnerId() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = hotelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    starRating: formData.get("starRating") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    city: formData.get("city"),
    countryCode: formData.get("countryCode"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hotels")
    .insert({
      partner_id: partnerId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description ?? null,
      star_rating: parsed.data.starRating ?? null,
      address_line: parsed.data.addressLine ?? null,
      city: parsed.data.city,
      country_code: parsed.data.countryCode.toUpperCase(),
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create hotel." };

  revalidatePath("/partner/hotels");
  redirect(`/partner/hotels/${data.id}`);
}

export async function updateHotel(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let partnerId: string;
  try {
    partnerId = await requirePartnerId();
  } catch (e) {
    // requireUser() inside requirePartnerId() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const hotelId = formData.get("hotelId");
  if (typeof hotelId !== "string") return { error: "Missing hotel id." };

  const parsed = hotelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    starRating: formData.get("starRating") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    city: formData.get("city"),
    countryCode: formData.get("countryCode"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hotels")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      star_rating: parsed.data.starRating ?? null,
      address_line: parsed.data.addressLine ?? null,
      city: parsed.data.city,
      country_code: parsed.data.countryCode.toUpperCase(),
      status: parsed.data.status,
    })
    .eq("id", hotelId)
    .eq("partner_id", partnerId);

  if (error) return { error: error.message };

  revalidatePath(`/partner/hotels/${hotelId}`);
  return { error: null };
}

const roomSchema = z.object({
  name: z.string().min(1, "Enter a room name."),
  description: z.string().optional(),
  maxOccupancy: z.coerce.number().int().min(1),
  bedType: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(LISTING_STATUSES),
});

async function assertOwnsHotel(supabase: Awaited<ReturnType<typeof createClient>>, hotelId: string, partnerId: string) {
  const { data } = await supabase.from("hotels").select("id").eq("id", hotelId).eq("partner_id", partnerId).maybeSingle();
  return !!data;
}

export async function createRoom(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let partnerId: string;
  try {
    partnerId = await requirePartnerId();
  } catch (e) {
    // requireUser() inside requirePartnerId() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const hotelId = formData.get("hotelId");
  if (typeof hotelId !== "string") return { error: "Missing hotel id." };

  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    maxOccupancy: formData.get("maxOccupancy"),
    bedType: formData.get("bedType") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "USD",
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await assertOwnsHotel(supabase, hotelId, partnerId))) {
    return { error: "Hotel not found." };
  }

  const { error } = await supabase.from("hotel_rooms").insert({
    hotel_id: hotelId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    max_occupancy: parsed.data.maxOccupancy,
    bed_type: parsed.data.bedType ?? null,
    base_price: parsed.data.basePrice,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status,
  });

  if (error) return { error: error.message };

  revalidatePath(`/partner/hotels/${hotelId}`);
  return { error: null };
}

export async function updateRoom(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let partnerId: string;
  try {
    partnerId = await requirePartnerId();
  } catch (e) {
    // requireUser() inside requirePartnerId() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const hotelId = formData.get("hotelId");
  const roomId = formData.get("roomId");
  if (typeof hotelId !== "string" || typeof roomId !== "string") return { error: "Missing ids." };

  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    maxOccupancy: formData.get("maxOccupancy"),
    bedType: formData.get("bedType") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "USD",
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await assertOwnsHotel(supabase, hotelId, partnerId))) {
    return { error: "Hotel not found." };
  }

  const { error } = await supabase
    .from("hotel_rooms")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      max_occupancy: parsed.data.maxOccupancy,
      bed_type: parsed.data.bedType ?? null,
      base_price: parsed.data.basePrice,
      currency: parsed.data.currency.toUpperCase(),
      status: parsed.data.status,
    })
    .eq("id", roomId)
    .eq("hotel_id", hotelId);

  if (error) return { error: error.message };

  revalidatePath(`/partner/hotels/${hotelId}`);
  return { error: null };
}

const bookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]),
});

export async function updateBookingStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let partnerId: string;
  try {
    partnerId = await requirePartnerId();
  } catch (e) {
    // requireUser() inside requirePartnerId() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const parsed = bookingStatusSchema.safeParse({
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("hotel_bookings")
    .select("id, hotel_id, hotels(partner_id)")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking || booking.hotels?.partner_id !== partnerId) {
    return { error: "Booking not found." };
  }

  const { error } = await supabase
    .from("hotel_bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId);

  if (error) return { error: error.message };

  revalidatePath("/partner/bookings");
  return { error: null };
}
