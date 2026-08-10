"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import type { Database } from "@/lib/types/database.types";
import { UMRAH_INCLUDE_KEYS } from "@/modules/umrah/includes";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type ListingStatus = Database["public"]["Enums"]["listing_status"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

// NOTE: the simple approve/reject actions that used to live here were
// superseded by src/modules/admin/application-actions.ts (approveApplication/
// rejectApplication/requestMoreInfo/etc.), which additionally call
// notifyApplicant() and — for agencies — redirect the admin into the
// tier/commission-rate/credit-limit setup on /admin/agencies/[id].

const orderStatuses: OrderStatus[] = ["pending_payment", "paid", "processing", "completed", "cancelled", "refunded"];

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!orderStatuses.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  return { error: null };
}

const visaTypeSchema = z.object({
  destinationCountryCode: z.string().min(2).max(2),
  name: z.string().min(2),
  description: z.string().optional(),
  overview: z.string().optional(),
  visaCategory: z.enum(["tourist", "business", "transit", "umrah", "work", "student", "family_visit"]),
  entryType: z.enum(["single", "multiple"]),
  validityDays: z.coerce.number().int().min(0).optional(),
  stayDays: z.coerce.number().int().min(0).optional(),
  processingDaysMin: z.coerce.number().int().min(0).optional(),
  processingDaysMax: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  requiredDocuments: z.string().optional(),
  isFeatured: z.boolean(),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

/**
 * One document slot per line: `key|Label|required|maxMB|description`
 * (last two segments optional). Serialized to the structured jsonb shape the
 * wizard's parseDocumentSlots() expects.
 */
function parseDocumentSlotLines(input: string | undefined) {
  if (!input) return [];
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, label, required, maxMb, description] = line.split("|").map((p) => p?.trim());
      return {
        key: (key || "document").toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        label: label || key || "Document",
        required: required !== "optional" && required !== "false",
        ...(maxMb && Number(maxMb) > 0 ? { max_mb: Number(maxMb) } : {}),
        ...(description ? { description } : {}),
      };
    });
}

function visaTypeInput(formData: FormData) {
  return {
    destinationCountryCode: formData.get("destinationCountryCode"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    overview: formData.get("overview") || undefined,
    visaCategory: formData.get("visaCategory") ?? "tourist",
    entryType: formData.get("entryType") ?? "single",
    validityDays: formData.get("validityDays") || undefined,
    stayDays: formData.get("stayDays") || undefined,
    processingDaysMin: formData.get("processingDaysMin") || undefined,
    processingDaysMax: formData.get("processingDaysMax") || undefined,
    price: formData.get("price"),
    currency: formData.get("currency"),
    requiredDocuments: formData.get("requiredDocuments") || undefined,
    isFeatured: formData.get("isFeatured") === "on",
    status: formData.get("status"),
  };
}

function visaTypeRow(data: z.infer<typeof visaTypeSchema>) {
  return {
    destination_country_code: data.destinationCountryCode.toUpperCase(),
    name: data.name,
    description: data.description ?? null,
    overview: data.overview ?? null,
    visa_category: data.visaCategory,
    entry_type: data.entryType,
    validity_days: data.validityDays ?? null,
    stay_days: data.stayDays ?? null,
    processing_days_min: data.processingDaysMin ?? null,
    processing_days_max: data.processingDaysMax ?? null,
    price: data.price,
    currency: data.currency.toUpperCase(),
    required_documents: parseDocumentSlotLines(data.requiredDocuments),
    is_featured: data.isFeatured,
    status: data.status as ListingStatus,
  };
}

export async function createVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = visaTypeSchema.safeParse(visaTypeInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("visa_types").insert(visaTypeRow(parsed.data));
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/visa");
  return { error: null };
}

export async function updateVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const parsed = visaTypeSchema.safeParse(visaTypeInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("visa_types").update(visaTypeRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/visa");
  return { error: null };
}

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

// Checkboxes in the admin form only ever post values from UMRAH_INCLUDE_OPTIONS,
// but this filters defensively rather than erroring — a stray/unknown value
// (e.g. a stale form after the option list changes) is just dropped instead
// of blocking the whole save.
const includesSchema = z
  .array(z.string())
  .transform((values) => values.filter((v) => (UMRAH_INCLUDE_KEYS as string[]).includes(v)));

const umrahPackageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationDays: z.coerce.number().int().min(1),
  includes: includesSchema,
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

export async function createUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = umrahPackageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationDays: formData.get("durationDays"),
    includes: formData.getAll("includes"),
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("umrah_packages").insert({
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description ?? null,
    duration_days: parsed.data.durationDays,
    includes: parsed.data.includes,
    base_price: parsed.data.basePrice,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status as ListingStatus,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/umrah");
  return { error: null };
}

export async function updateUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const parsed = umrahPackageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationDays: formData.get("durationDays"),
    includes: formData.getAll("includes"),
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_packages")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      duration_days: parsed.data.durationDays,
      includes: parsed.data.includes,
      base_price: parsed.data.basePrice,
      currency: parsed.data.currency.toUpperCase(),
      status: parsed.data.status as ListingStatus,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/umrah");
  return { error: null };
}

const departureSchema = z.object({
  packageId: z.string().uuid(),
  departureDate: z.string().min(1, "Pick a departure date."),
  returnDate: z.string().min(1, "Pick a return date."),
  totalSeats: z.coerce.number().int().min(1),
});

export async function createUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = departureSchema.safeParse({
    packageId: formData.get("packageId"),
    departureDate: formData.get("departureDate"),
    returnDate: formData.get("returnDate"),
    totalSeats: formData.get("totalSeats"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.returnDate <= parsed.data.departureDate) {
    return { error: "Return date must be after the departure date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("umrah_package_departures").insert({
    package_id: parsed.data.packageId,
    departure_date: parsed.data.departureDate,
    return_date: parsed.data.returnDate,
    total_seats: parsed.data.totalSeats,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/umrah");
  return { error: null };
}

export async function toggleUserStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const userId = String(formData.get("userId"));
  const newStatus = String(formData.get("newStatus")) as AccountStatus;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_account_status", { target_user_id: userId, new_status: newStatus });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Event venues & hall bookings
// ---------------------------------------------------------------------------
const venueSchema = z.object({
  name: z.string().min(2),
  tagline: z.string().optional(),
  description: z.string().optional(),
  city: z.string().min(2),
  address: z.string().optional(),
  capacitySeated: z.coerce.number().int().min(1).optional(),
  capacityStanding: z.coerce.number().int().min(1).optional(),
  sizeSqm: z.coerce.number().min(0).optional(),
  amenities: z.string().optional(),
  eventTypes: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  priceUnit: z.enum(["per_event", "per_day", "per_hour"]),
  isFeatured: z.boolean(),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

function commaList(input: string | undefined) {
  if (!input) return [];
  return input
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

function venueInput(formData: FormData) {
  return {
    name: formData.get("name"),
    tagline: formData.get("tagline") || undefined,
    description: formData.get("description") || undefined,
    city: formData.get("city"),
    address: formData.get("address") || undefined,
    capacitySeated: formData.get("capacitySeated") || undefined,
    capacityStanding: formData.get("capacityStanding") || undefined,
    sizeSqm: formData.get("sizeSqm") || undefined,
    amenities: formData.get("amenities") || undefined,
    eventTypes: formData.get("eventTypes") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency"),
    priceUnit: formData.get("priceUnit") ?? "per_event",
    isFeatured: formData.get("isFeatured") === "on",
    status: formData.get("status"),
  };
}

function venueRow(data: z.infer<typeof venueSchema>) {
  return {
    name: data.name,
    tagline: data.tagline ?? null,
    description: data.description ?? null,
    city: data.city,
    address: data.address ?? null,
    capacity_seated: data.capacitySeated ?? null,
    capacity_standing: data.capacityStanding ?? null,
    size_sqm: data.sizeSqm ?? null,
    amenities: commaList(data.amenities),
    event_types: commaList(data.eventTypes),
    base_price: data.basePrice,
    currency: data.currency.toUpperCase(),
    price_unit: data.priceUnit,
    is_featured: data.isFeatured,
    status: data.status as ListingStatus,
  };
}

export async function createVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = venueSchema.safeParse(venueInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_venues")
    .insert({ ...venueRow(parsed.data), slug: slugify(parsed.data.name) });
  if (error) return { error: error.message };
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { error: null };
}

export async function updateVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const parsed = venueSchema.safeParse(venueInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("event_venues").update(venueRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { error: null };
}

const hallBookingStatuses = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "refunded",
  "no_show",
  "failed",
] as const;

export async function updateHallBookingStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const status = String(formData.get("status"));
  if (!hallBookingStatuses.includes(status as (typeof hallBookingStatuses)[number])) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hall_bookings")
    .update({ status: status as (typeof hallBookingStatuses)[number] })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath("/admin/events");
  return { error: null };
}

/** Quote/adjust the hall price; keeps the unpaid order's totals in sync. */
export async function updateHallBookingPrice(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price." };

  const supabase = await createClient();
  const { error } = await supabase.from("hall_bookings").update({ price }).eq("id", bookingId);
  if (error) return { error: error.message };

  const { data: item } = await supabase
    .from("order_items")
    .select("id, order:order_id (id, status)")
    .eq("hall_booking_id", bookingId)
    .maybeSingle();
  if (item?.order && item.order.status === "pending_payment") {
    await supabase
      .from("order_items")
      .update({ unit_price: price, total_price: price })
      .eq("id", item.id);
    await supabase
      .from("orders")
      .update({ subtotal: price, total: price })
      .eq("id", item.order.id);
  }

  revalidatePath("/admin/events");
  return { error: null };
}
