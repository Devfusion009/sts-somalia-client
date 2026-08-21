"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getMyHotelScope, type HotelScope } from "@/modules/hotels/partner-queries";
import { rememberRoomType } from "@/modules/hotels/room-types";
import type { ActionState } from "@/lib/auth/actions";

// Partner-facing forms deliberately exclude 'published': a partner could
// previously self-publish a hotel/room straight to live, bookable-by-real-
// customers status with zero admin review — no KYC check, no listing
// review, nothing. Only admin can publish (adminSetHotelStatus /
// adminSetRoomStatus in modules/admin/actions.ts), matching the
// venue_partner pattern this codebase already uses correctly.
const PARTNER_LISTING_STATUSES = ["draft", "pending_review"] as const;

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

/**
 * Room/inventory/booking actions are scoped to "every hotel I can operate,"
 * which for a hotel_manager includes hotels with no partnerId at all — the
 * partnerId-only requirePartnerId() above can't express that, so these use
 * this instead and check hotelId membership in hotelIds rather than a
 * partner_id column match.
 */
async function requireHotelScope(): Promise<HotelScope> {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);
  if (scope.hotelIds.length === 0) {
    throw new Error("No hotel access found for this user.");
  }
  return scope;
}

const hotelSchema = z.object({
  name: z.string().min(2, "Enter a hotel name."),
  description: z.string().optional(),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(1, "Enter a city."),
  countryCode: z.string().min(2, "Enter a country code.").max(2),
  status: z.enum(PARTNER_LISTING_STATUSES),
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

  // A hotel admin already published/suspended is out of the partner's
  // hands — only touch status while it's still draft/pending_review, same
  // guard venue_partner already uses. Otherwise an edit-and-save on a live
  // listing would silently knock it back to draft.
  const { data: current } = await supabase.from("hotels").select("status").eq("id", hotelId).maybeSingle();
  const statusUpdate = current && ["draft", "pending_review"].includes(current.status) ? { status: parsed.data.status } : {};

  const { error } = await supabase
    .from("hotels")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      star_rating: parsed.data.starRating ?? null,
      address_line: parsed.data.addressLine ?? null,
      city: parsed.data.city,
      country_code: parsed.data.countryCode.toUpperCase(),
      ...statusUpdate,
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
  floor: z.string().optional(),
  sizeSqm: z.coerce.number().min(0).optional(),
  amenities: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
      } catch {
        return [];
      }
    }),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(PARTNER_LISTING_STATUSES),
});

export async function createRoom(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let scope: HotelScope;
  try {
    scope = await requireHotelScope();
  } catch (e) {
    // requireUser() inside requireHotelScope() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const hotelId = formData.get("hotelId");
  if (typeof hotelId !== "string") return { error: "Missing hotel id." };
  if (!scope.hotelIds.includes(hotelId)) return { error: "Hotel not found." };

  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    maxOccupancy: formData.get("maxOccupancy"),
    bedType: formData.get("bedType") || undefined,
    floor: formData.get("floor") || undefined,
    sizeSqm: formData.get("sizeSqm") || undefined,
    amenities: formData.get("amenities") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "USD",
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_rooms").insert({
    hotel_id: hotelId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    max_occupancy: parsed.data.maxOccupancy,
    bed_type: parsed.data.bedType ?? null,
    floor: parsed.data.floor ?? null,
    size_sqm: parsed.data.sizeSqm ?? null,
    amenities: parsed.data.amenities,
    base_price: parsed.data.basePrice,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status,
  });

  if (error) return { error: error.message };
  await rememberRoomType(supabase, parsed.data.name);

  revalidatePath(`/partner/hotels/${hotelId}`);
  return { error: null };
}

export async function updateRoom(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let scope: HotelScope;
  try {
    scope = await requireHotelScope();
  } catch (e) {
    // requireUser() inside requireHotelScope() throws Next's internal
    // redirect signal when signed out — let it propagate instead of
    // displaying it as a literal error string.
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  const hotelId = formData.get("hotelId");
  const roomId = formData.get("roomId");
  if (typeof hotelId !== "string" || typeof roomId !== "string") return { error: "Missing ids." };
  if (!scope.hotelIds.includes(hotelId)) return { error: "Hotel not found." };

  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    maxOccupancy: formData.get("maxOccupancy"),
    bedType: formData.get("bedType") || undefined,
    floor: formData.get("floor") || undefined,
    sizeSqm: formData.get("sizeSqm") || undefined,
    amenities: formData.get("amenities") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "USD",
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Same admin-owns-published guard as updateHotel above.
  const { data: current } = await supabase.from("hotel_rooms").select("status").eq("id", roomId).maybeSingle();
  const statusUpdate = current && ["draft", "pending_review"].includes(current.status) ? { status: parsed.data.status } : {};

  const { error } = await supabase
    .from("hotel_rooms")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      max_occupancy: parsed.data.maxOccupancy,
      bed_type: parsed.data.bedType ?? null,
      floor: parsed.data.floor ?? null,
      size_sqm: parsed.data.sizeSqm ?? null,
      amenities: parsed.data.amenities,
      base_price: parsed.data.basePrice,
      currency: parsed.data.currency.toUpperCase(),
      ...statusUpdate,
    })
    .eq("id", roomId)
    .eq("hotel_id", hotelId);

  if (error) return { error: error.message };
  await rememberRoomType(supabase, parsed.data.name);

  revalidatePath(`/partner/hotels/${hotelId}`);
  return { error: null };
}

const bookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]),
});

export async function updateBookingStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let scope: HotelScope;
  try {
    scope = await requireHotelScope();
  } catch (e) {
    // requireUser() inside requireHotelScope() throws Next's internal
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
    .select("id, hotel_id")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking || !scope.hotelIds.includes(booking.hotel_id)) {
    return { error: "Booking not found." };
  }

  // Business owners can always work their own booking queue; a hotel_manager
  // (scope.partnerId null) needs the can_manage_bookings flag admin grants
  // per hotel (20260821000002) — RLS enforces this for real, this is just a
  // clean error instead of a raw policy violation.
  if (scope.partnerId === null) {
    const { data: manager } = await supabase
      .from("hotel_managers")
      .select("can_manage_bookings")
      .eq("hotel_id", booking.hotel_id)
      .eq("profile_id", (await requireUser()).id)
      .eq("status", "active")
      .maybeSingle();
    if (!manager?.can_manage_bookings) {
      return { error: "You don't have permission to manage bookings for this hotel." };
    }
  }

  const { error } = await supabase
    .from("hotel_bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId);

  if (error) return { error: error.message };

  revalidatePath("/partner/bookings");
  return { error: null };
}
