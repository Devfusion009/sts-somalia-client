"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { umrahImagePaths } from "./images";

type Supa = Awaited<ReturnType<typeof createClient>>;

function revalidatePackage(packageId: string) {
  revalidatePath(`/admin/catalog/umrah/${packageId}`);
  revalidatePath("/admin/catalog/umrah");
  revalidatePath("/umrah");
}

/**
 * base_price is the amount actually charged per pilgrim (see
 * modules/umrah/actions.ts, which uses `price_override ?? base_price`), and
 * it's also the "starting from" figure on the public cards. Whenever a rate
 * card exists it must therefore equal the cheapest sharing rate, or the
 * advertised price and the charged price silently diverge. Deriving it here
 * — rather than leaving it as a second, hand-maintained number — keeps one
 * source of truth. With no rate-card rows, base_price stays whatever the
 * package form set.
 */
async function recalcBasePrice(supabase: Supa, packageId: string) {
  const { data: rows } = await supabase
    .from("umrah_package_pricing")
    .select("price")
    .eq("package_id", packageId);

  if (!rows || rows.length === 0) return;
  const cheapest = Math.min(...rows.map((r) => Number(r.price)));
  await supabase.from("umrah_packages").update({ base_price: cheapest }).eq("id", packageId);
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/**
 * Multi-file gallery upload — the first multi-upload in this codebase, so
 * the shape is deliberate: every file is validated BEFORE any upload runs,
 * so a bad file in the batch fails the whole batch instead of leaving a
 * half-uploaded gallery. Successfully uploaded paths are rolled back from
 * storage if the row update then fails (same compensating-delete pattern as
 * uploadAgencyLogoAction).
 */
export async function uploadUmrahImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  if (!z.string().uuid().safeParse(packageId).success) return { error: "Unknown package." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one image." };
  if (files.length > 10) return { error: "Upload at most 10 images at a time." };

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: `${file.name}: only JPG, PNG, or WebP images are accepted.` };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: `${file.name}: each image must be 5MB or smaller.` };
    }
  }

  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("umrah_packages")
    .select("images")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return { error: "Unknown package." };

  const uploaded: string[] = [];
  for (const file of files) {
    const path = `${packageId}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("umrah-images")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      if (uploaded.length > 0) await supabase.storage.from("umrah-images").remove(uploaded);
      return { error: uploadError.message };
    }
    uploaded.push(path);
  }

  const next = [...umrahImagePaths(pkg.images), ...uploaded];
  const { error } = await supabase.from("umrah_packages").update({ images: next }).eq("id", packageId);
  if (error) {
    await supabase.storage.from("umrah-images").remove(uploaded);
    return { error: error.message };
  }

  revalidatePackage(packageId);
  return { error: null };
}

export async function removeUmrahImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!packageId || !path) return;

  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("umrah_packages")
    .select("images")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return;

  const next = umrahImagePaths(pkg.images).filter((p) => p !== path);
  await supabase.from("umrah_packages").update({ images: next }).eq("id", packageId);
  await supabase.storage.from("umrah-images").remove([path]);

  revalidatePackage(packageId);
}

/** Promotes one image to index 0 — the cover shot used on cards and the detail hero. */
export async function setUmrahCoverImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!packageId || !path) return;

  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("umrah_packages")
    .select("images")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return;

  const paths = umrahImagePaths(pkg.images);
  if (!paths.includes(path)) return;
  const next = [path, ...paths.filter((p) => p !== path)];
  await supabase.from("umrah_packages").update({ images: next }).eq("id", packageId);

  revalidatePackage(packageId);
}

// ---------------------------------------------------------------------------
// Package-level marketing / operations detail
// ---------------------------------------------------------------------------
const optionalText = (max: number) => z.string().trim().max(max).optional();

const detailsSchema = z.object({
  packageId: z.string().uuid(),
  tagline: optionalText(200),
  tier: optionalText(40),
  isFeatured: z.boolean(),
  originIata: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{3}$/.test(v), "Use a 3-letter airport code, e.g. MGQ.")
    .optional(),
  destinationIata: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{3}$/.test(v), "Use a 3-letter airport code, e.g. JED.")
    .optional(),
  // Order matters: z.coerce.number() on "" coerces to 0 (Number("") === 0),
  // which passes .min(0) and silently turns "leave blank" into a real $0
  // discount price. Trying the empty-string literal FIRST makes a blank
  // field actually stay blank; z.union takes the first schema that matches.
  originalPrice: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  mealPlan: z.enum(["none", "breakfast", "half_board", "full_board"]),
  mealsNote: optionalText(500),
  contactPersonName: optionalText(120),
  contactPersonPhone: optionalText(40),
  contactPersonEmail: z.union([z.string().trim().email("Enter a valid contact email."), z.literal("")]).optional(),
  contactWhatsapp: optionalText(40),
});

export async function updateUmrahPackageDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = detailsSchema.safeParse({
    packageId: formData.get("packageId"),
    tagline: formData.get("tagline") || undefined,
    tier: formData.get("tier") || undefined,
    isFeatured: formData.get("isFeatured") === "on",
    originIata: formData.get("originIata") || undefined,
    destinationIata: formData.get("destinationIata") || undefined,
    originalPrice: formData.get("originalPrice") ?? "",
    mealPlan: formData.get("mealPlan"),
    mealsNote: formData.get("mealsNote") || undefined,
    contactPersonName: formData.get("contactPersonName") || undefined,
    contactPersonPhone: formData.get("contactPersonPhone") || undefined,
    contactPersonEmail: formData.get("contactPersonEmail") ?? "",
    contactWhatsapp: formData.get("contactWhatsapp") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_packages")
    .update({
      tagline: d.tagline || null,
      tier: d.tier || null,
      is_featured: d.isFeatured,
      origin_iata: d.originIata || null,
      destination_iata: d.destinationIata || null,
      original_price: d.originalPrice === "" || d.originalPrice === undefined ? null : d.originalPrice,
      meal_plan: d.mealPlan,
      meals_note: d.mealsNote || null,
      contact_person_name: d.contactPersonName || null,
      contact_person_phone: d.contactPersonPhone || null,
      contact_person_email: d.contactPersonEmail || null,
      contact_whatsapp: d.contactWhatsapp || null,
    })
    .eq("id", d.packageId);
  if (error) return { error: error.message };

  revalidatePackage(d.packageId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------
const hotelSchema = z.object({
  packageId: z.string().uuid(),
  hotelRowId: z.union([z.string().uuid(), z.literal("")]).optional(),
  city: z.enum(["makkah", "madinah", "other"]),
  name: z.string().trim().min(2, "Enter the hotel name."),
  starRating: z.union([z.coerce.number().int().min(1).max(5), z.literal("")]).optional(),
  distanceToHaramM: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  nights: z.union([z.coerce.number().int().min(1), z.literal("")]).optional(),
  roomType: optionalText(80),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

function blankToNull<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function saveUmrahHotel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = hotelSchema.safeParse({
    packageId: formData.get("packageId"),
    hotelRowId: formData.get("hotelRowId") ?? "",
    city: formData.get("city"),
    name: formData.get("name"),
    starRating: formData.get("starRating") ?? "",
    distanceToHaramM: formData.get("distanceToHaramM") ?? "",
    nights: formData.get("nights") ?? "",
    roomType: formData.get("roomType") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const payload = {
    package_id: d.packageId,
    city: d.city,
    name: d.name,
    star_rating: blankToNull(d.starRating),
    distance_to_haram_m: blankToNull(d.distanceToHaramM),
    nights: blankToNull(d.nights),
    room_type: d.roomType || null,
    sort_order: d.sortOrder,
  };

  const { error } = d.hotelRowId
    ? await supabase.from("umrah_package_hotels").update(payload).eq("id", d.hotelRowId)
    : await supabase.from("umrah_package_hotels").insert(payload);
  if (error) return { error: error.message };

  revalidatePackage(d.packageId);
  return { error: null };
}

export async function deleteUmrahHotel(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  const id = String(formData.get("hotelRowId") ?? "");
  if (!packageId || !id) return;

  const supabase = await createClient();
  await supabase.from("umrah_package_hotels").delete().eq("id", id).eq("package_id", packageId);
  revalidatePackage(packageId);
}

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------
const itinerarySchema = z.object({
  packageId: z.string().uuid(),
  dayId: z.union([z.string().uuid(), z.literal("")]).optional(),
  dayNumber: z.coerce.number().int().min(1, "Day number starts at 1."),
  title: z.string().trim().min(2, "Give the day a title."),
  description: optionalText(2000),
});

export async function saveUmrahItineraryDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = itinerarySchema.safeParse({
    packageId: formData.get("packageId"),
    dayId: formData.get("dayId") ?? "",
    dayNumber: formData.get("dayNumber"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const payload = {
    package_id: d.packageId,
    day_number: d.dayNumber,
    title: d.title,
    description: d.description || null,
  };

  const { error } = d.dayId
    ? await supabase.from("umrah_itinerary_days").update(payload).eq("id", d.dayId)
    : await supabase.from("umrah_itinerary_days").insert(payload);
  if (error) {
    // unique (package_id, day_number)
    if (error.code === "23505") return { error: `Day ${d.dayNumber} already exists — edit it instead.` };
    return { error: error.message };
  }

  revalidatePackage(d.packageId);
  return { error: null };
}

export async function deleteUmrahItineraryDay(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  const id = String(formData.get("dayId") ?? "");
  if (!packageId || !id) return;

  const supabase = await createClient();
  await supabase.from("umrah_itinerary_days").delete().eq("id", id).eq("package_id", packageId);
  revalidatePackage(packageId);
}

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------
const pricingSchema = z.object({
  packageId: z.string().uuid(),
  sharing: z.coerce.number().int().min(1).max(12),
  price: z.coerce.number().min(0),
});

export async function saveUmrahPricing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = pricingSchema.safeParse({
    packageId: formData.get("packageId"),
    sharing: formData.get("sharing"),
    price: formData.get("price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_package_pricing")
    .upsert({ package_id: d.packageId, sharing: d.sharing, price: d.price }, { onConflict: "package_id,sharing" });
  if (error) return { error: error.message };

  await recalcBasePrice(supabase, d.packageId);
  revalidatePackage(d.packageId);
  return { error: null };
}

export async function deleteUmrahPricing(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  const id = String(formData.get("pricingId") ?? "");
  if (!packageId || !id) return;

  const supabase = await createClient();
  await supabase.from("umrah_package_pricing").delete().eq("id", id).eq("package_id", packageId);
  await recalcBasePrice(supabase, packageId);
  revalidatePackage(packageId);
}

// ---------------------------------------------------------------------------
// Local agencies
// ---------------------------------------------------------------------------
/**
 * Replaces the whole assignment set in one submit (the form posts every
 * checked agency). Delete-then-insert rather than diffing: the set is small
 * and admin-only, and this keeps the action honest about what it does.
 */
export async function setUmrahPackageAgencies(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = String(formData.get("packageId") ?? "");
  if (!z.string().uuid().safeParse(packageId).success) return { error: "Unknown package." };

  const agencyIds = formData
    .getAll("agencyIds")
    .map(String)
    .filter((id) => z.string().uuid().safeParse(id).success);

  const supabase = await createClient();
  const { error: delError } = await supabase.from("umrah_package_agencies").delete().eq("package_id", packageId);
  if (delError) return { error: delError.message };

  if (agencyIds.length > 0) {
    const { error } = await supabase
      .from("umrah_package_agencies")
      .insert(agencyIds.map((agency_id) => ({ package_id: packageId, agency_id })));
    if (error) return { error: error.message };
  }

  revalidatePackage(packageId);
  return { error: null };
}
