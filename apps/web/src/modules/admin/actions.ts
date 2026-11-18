"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";
import { inventoryRows, parseInventoryDetail } from "@/modules/hotels/inventory-rows";
import { z } from "zod";
import { phoneSchema } from "@/modules/partner-applications/schemas";
import { applyHotelBookingMove } from "@/modules/hotels/booking-status";
import { todayIso } from "@/modules/hotels/availability";
import { createClient } from "@/lib/supabase/server";
import { nextHallBookingMoves } from "@/modules/events/hall-transitions";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import type { Database } from "@/lib/types/database.types";
import { rememberRoomType } from "@/modules/hotels/room-types";
import { uploadImages } from "@/modules/admin/property-gallery-actions";
import { TARGETS } from "@/modules/admin/gallery-targets";
import { repriceQuotedOrder } from "@/modules/orders/helpers";
import { commaList, parseLinks, replacePropertyLinks } from "@/modules/hotels/listing-fields";
import { parseDocumentSlotsJson, parseRequirementSectionsJson } from "./visa-type-utils";
import { COUNTRY_NAMES } from "@/lib/countries";
import { invalidateCache } from "@/lib/redis";
import { departureInput } from "@/modules/umrah/departure-input";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type ListingStatus = Database["public"]["Enums"]["listing_status"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

// NOTE: the simple approve/reject actions that used to live here were
// superseded by src/modules/admin/application-actions.ts (approveApplication/
// rejectApplication/requestMoreInfo/etc.), which additionally call
// notifyApplicant() and — for agencies — redirect the admin into the
// tier/commission-rate/credit-limit setup on /admin/agencies/[id].

const orderStatuses: OrderStatus[] = [
  "pending_payment",
  "partially_paid",
  "paid",
  "processing",
  "completed",
  "cancelled",
  "refunded",
];

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!orderStatuses.includes(status)) return { error: "Invalid status." };

  if (["paid", "partially_paid", "refunded"].includes(status)) {
    return { error: "Use payment approval, record payment or the refund workflow to update payment status." };
  }
  const supabase = await createClient();
  if (["processing", "completed"].includes(status)) {
    const { data: current } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
    if (!current || !["paid", "partially_paid", "processing", "completed"].includes(current.status)) {
      return { error: "Approve the payment before processing or completing this order." };
    }
  }
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  return { error: null };
}

const visaTypeSchema = z.object({
  destinationCountryCode: z
    .string()
    .transform((code) => code.trim().toUpperCase())
    .refine((code) => code in COUNTRY_NAMES, "Choose the destination country."),
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
  applicationSections: z.string().optional(),
  processingFee: z.coerce.number().min(0).optional(),
  eligibilityRequirements: z.string().optional(),
  termsAndConditions: z.string().optional(),
  isFeatured: z.boolean(),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
  processingMode: z.enum(["in_house", "partner"]),
  partnerProviderKey: z.string().optional(),
  requiresAppointment: z.boolean(),
  requiresBiometrics: z.boolean(),
  requiresPhysicalPassport: z.boolean(),
  passportDeliveryModes: z.array(z.enum(["counter", "courier", "third_party"])).min(1, "Offer at least one passport return option."),
  internalSlaDays: z.coerce.number().int().min(0).max(60),
  centreIds: z.array(z.string().uuid()),
})
  .refine((data) => data.processingMode !== "partner" || !!data.partnerProviderKey, {
    message: "Choose which partner processes this visa type.",
    path: ["partnerProviderKey"],
  })
  .refine(
    (data) =>
      data.processingDaysMin === undefined ||
      data.processingDaysMax === undefined ||
      data.processingDaysMax >= data.processingDaysMin,
    { message: "Maximum processing days can't be less than the minimum.", path: ["processingDaysMax"] },
  );

const VISA_IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_VISA_IMAGE_BYTES = 5 * 1024 * 1024;

/** The cover-image part of the visa form: a new file and/or a request to clear the current one. */
function visaCoverInput(formData: FormData) {
  const file = formData.get("coverImage");
  return {
    file: file instanceof File && file.size > 0 ? file : null,
    remove: formData.get("removeCoverImage") === "on",
  };
}

function validateVisaCover(file: File | null): string | null {
  if (!file) return null;
  if (!VISA_IMAGE_EXT[file.type]) return "Cover image must be a JPG, PNG, or WebP.";
  if (file.size > MAX_VISA_IMAGE_BYTES) return "Cover image must be 5MB or smaller.";
  return null;
}

/** Store a replacement cover (or clear it), then drop the object it replaces. Returns an error message, or null. */
async function applyVisaCover(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visaTypeId: string,
  { file, remove }: ReturnType<typeof visaCoverInput>
): Promise<string | null> {
  if (!file && !remove) return null;

  const { data: current } = await supabase.from("visa_types").select("cover_image").eq("id", visaTypeId).maybeSingle();
  const previous = current?.cover_image ?? null;

  let next: string | null = null;
  if (file) {
    next = `${visaTypeId}/${Date.now()}.${VISA_IMAGE_EXT[file.type]}`;
    const { error: uploadError } = await supabase.storage.from("visa-images").upload(next, file, { contentType: file.type });
    if (uploadError) return uploadError.message;
  }

  const { error } = await supabase.from("visa_types").update({ cover_image: next }).eq("id", visaTypeId);
  if (error) {
    if (next) await supabase.storage.from("visa-images").remove([next]);
    return error.message;
  }

  if (previous && !previous.startsWith("http") && !previous.startsWith("/")) {
    await supabase.storage.from("visa-images").remove([previous]);
  }
  return null;
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
    applicationSections: formData.get("applicationSections") || undefined,
    processingFee: formData.get("processingFee") || undefined,
    eligibilityRequirements: formData.get("eligibilityRequirements") || undefined,
    termsAndConditions: formData.get("termsAndConditions") || undefined,
    isFeatured: formData.get("isFeatured") === "on",
    status: formData.get("status"),
    processingMode: formData.get("processingMode") ?? "in_house",
    partnerProviderKey: formData.get("partnerProviderKey") || undefined,
    requiresAppointment: formData.get("requiresAppointment") === "on",
    requiresBiometrics: formData.get("requiresBiometrics") === "on",
    requiresPhysicalPassport: formData.get("requiresPhysicalPassport") === "on",
    passportDeliveryModes: formData.getAll("passportDeliveryModes").map(String),
    internalSlaDays: formData.get("internalSlaDays") || 2,
    centreIds: formData.getAll("centreIds").map(String),
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
    required_documents: parseDocumentSlotsJson(data.requiredDocuments),
    application_sections: parseRequirementSectionsJson(data.applicationSections),
    processing_fee: data.processingFee ?? null,
    eligibility_requirements: data.eligibilityRequirements ?? null,
    terms_and_conditions: data.termsAndConditions ?? null,
    is_featured: data.isFeatured,
    status: data.status as ListingStatus,
    processing_mode: data.processingMode,
    partner_provider_key: data.processingMode === "partner" ? (data.partnerProviderKey ?? null) : null,
    requires_appointment: data.requiresAppointment,
    requires_biometrics: data.requiresBiometrics,
    requires_physical_passport: data.requiresPhysicalPassport,
    passport_delivery_modes: data.passportDeliveryModes,
    internal_sla_days: data.internalSlaDays,
  };
}

/** Replace a visa type's centre list (empty = every active centre is offered). */
async function saveVisaTypeCentres(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visaTypeId: string,
  centreIds: string[]
) {
  await supabase.from("visa_type_centres").delete().eq("visa_type_id", visaTypeId);
  if (centreIds.length > 0) {
    await supabase
      .from("visa_type_centres")
      .insert(centreIds.map((centre_id) => ({ visa_type_id: visaTypeId, centre_id })));
  }
}

export async function createVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = visaTypeSchema.safeParse(visaTypeInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cover = visaCoverInput(formData);
  const coverError = validateVisaCover(cover.file);
  if (coverError) return { error: coverError };

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("visa_types").insert(visaTypeRow(parsed.data)).select("id").single();
  if (error || !created) return { error: error?.message ?? "Could not create the visa type." };
  await saveVisaTypeCentres(supabase, created.id, parsed.data.centreIds);
  const uploadError = await applyVisaCover(supabase, created.id, cover);
  await invalidateCache("visa");
  revalidatePath("/admin/catalog/visa");
  revalidatePath("/visa");
  // The visa type exists at this point; reopen it so the image can be retried
  // there instead of resubmitting this form and creating a duplicate.
  redirect(uploadError ? `/admin/catalog/visa/${created.id}/edit` : "/admin/catalog/visa");
}

export async function updateVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const parsed = visaTypeSchema.safeParse(visaTypeInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cover = visaCoverInput(formData);
  const coverError = validateVisaCover(cover.file);
  if (coverError) return { error: coverError };

  const supabase = await createClient();
  const { error } = await supabase.from("visa_types").update(visaTypeRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  await saveVisaTypeCentres(supabase, id, parsed.data.centreIds);
  const uploadError = await applyVisaCover(supabase, id, cover);
  await invalidateCache("visa");
  if (uploadError) return { error: uploadError };
  revalidatePath("/visa");
  revalidatePath("/admin/catalog/visa");
  revalidatePath(`/admin/catalog/visa/${id}/edit`);
  redirect("/admin/catalog/visa");
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

// ---------------------------------------------------------------------------
// Umrah packages and departures — form adapters; apps/api validates and writes.
// ---------------------------------------------------------------------------

function umrahPackageInput(formData: FormData) {
  const requestFirst = formData.get("requestFirst") === "on";
  return {
    ...(requestFirst ? {requestFirst:true,
      formationClosesAt:new Date(`${formData.get("formationClosesAt")}:00+03:00`).toISOString(),
      paymentCutoffAt:new Date(`${formData.get("paymentCutoffAt")}:00+03:00`).toISOString(),
      paymentWindowHours:Number(formData.get("paymentWindowHours")), requestTerms:String(formData.get("requestTerms") ?? ""),
    } : {}),
    packageType: String(formData.get("packageType") ?? "group") as "group" | "private",
    originIata: String(formData.get("originIata") ?? "").trim() || undefined,
    destinationIata: String(formData.get("destinationIata") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    poolVisibility: String(formData.get("poolVisibility") ?? "public") as "public" | "private",
    organizerName: String(formData.get("organizerName") ?? "").trim(),
    organizerEmail: String(formData.get("organizerEmail") ?? "").trim() || undefined,
    contactPersonName: String(formData.get("contactPersonName") ?? ""),
    contactPersonPhone: String(formData.get("contactPersonPhone") ?? ""),
    agentContacts: formData.getAll("agentContactName").map((name, index) => ({ name: String(name).trim(), phone: String(formData.getAll("agentContactPhone")[index] ?? "").trim() })).filter(contact => contact.name || contact.phone),
    facilities: String(formData.get("facilities") ?? ""),
    accommodationDetails: String(formData.get("accommodationDetails") ?? ""),
    flightDetails: String(formData.get("flightDetails") ?? ""),
    transportDetails: String(formData.get("transportDetails") ?? ""),
    mealsNote: String(formData.get("mealsNote") ?? ""),
    nightsMakkah: formData.has("nightsMakkah") ? Number(formData.get("nightsMakkah")) : undefined,
    nightsMadinah: formData.has("nightsMadinah") ? Number(formData.get("nightsMadinah")) : undefined,
    totalSeats: formData.has("totalSeats") ? Number(formData.get("totalSeats")) : undefined,
    departureDate: String(formData.get("departureDate") ?? "") || undefined,
    durationDays: Number(formData.get("durationDays")),
    includes: formData.getAll("includes").map(String),
    basePrice: Number(formData.get("basePrice")),
    currency: String(formData.get("currency") ?? ""),
    status: String(formData.get("status")) as "draft",
  };
}

export async function createUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  let packageId: string;
  try {
    const saved = await (await getServerTrpcForActions()).umrah.admin.packages.upsert.mutate({ ...umrahPackageInput(formData), status: "draft" });
    packageId = saved.id;
  } catch (error) {
    return { error: trpcErrorMessage(error, "The package could not be saved.") };
  }
  revalidatePath("/admin/umrah/pool");
  revalidatePath("/admin/umrah/pool", "layout");
  revalidatePath("/admin/catalog/umrah");
  redirect(`/admin/umrah/pool/${packageId}`);
}

export async function updateUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    await (await getServerTrpcForActions()).umrah.admin.packages.upsert.mutate({
      id: String(formData.get("id")),
      ...umrahPackageInput(formData),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The package could not be saved.") };
  }
  revalidatePath("/admin/umrah/pool");
  revalidatePath("/admin/umrah/pool", "layout");
  revalidatePath("/admin/catalog/umrah");
  revalidatePath(`/admin/catalog/umrah/${String(formData.get("id"))}`);
  revalidatePath("/umrah", "layout");
  return { error: null };
}
function revalidateUmrahPackage(packageId: string) {
  revalidatePath("/admin/umrah/pool");
  revalidatePath("/admin/umrah/pool", "layout");
  revalidatePath("/admin/catalog/umrah");
  revalidatePath(`/admin/catalog/umrah/${packageId}`);
}

async function saveUmrahDepartureFrom(formData: FormData): Promise<ActionState> {
  const input = departureInput(formData);
  try {
    await (await getServerTrpcForActions()).umrah.admin.packages.saveDeparture.mutate(input);
  } catch (error) {
    return { error: trpcErrorMessage(error, "The departure could not be saved.") };
  }
  revalidateUmrahPackage(input.packageId);
  return { error: null };
}

export async function createUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  formData.delete("departureId");
  return saveUmrahDepartureFrom(formData);
}

export async function updateUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!String(formData.get("departureId") ?? "")) return { error: "Invalid departure." };
  return saveUmrahDepartureFrom(formData);
}

export async function deleteUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const { packageId } = await (await getServerTrpcForActions()).umrah.admin.packages.deleteDeparture.mutate({
      departureId: String(formData.get("departureId") ?? ""),
    });
    revalidateUmrahPackage(packageId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The departure could not be deleted.") };
  }
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
  name: z.string().trim().min(2, "Enter the venue name."),
  tagline: z.string().optional(),
  description: z.string().optional(),
  city: z.string().trim().min(2, "Enter the city."),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactEmail: z.string().email("Enter a valid contact email.").optional().or(z.literal("")),
  capacitySeated: z.coerce.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").optional(),
  capacityStanding: z.coerce.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").optional(),
  sizeSqm: z.coerce.number().min(0, "Size can't be negative.").optional(),
  amenities: z.string().optional(),
  eventTypes: z.string().optional(),
  policies: z.string().optional(),
  links: z.string().optional(),
  basePrice: z.coerce.number().min(0, "The price can't be negative."),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Enter a 3-letter currency code."),
  priceUnit: z.enum(["per_event", "per_day", "per_hour", "per_person"]),
  isFeatured: z.boolean(),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

function venueInput(formData: FormData) {
  return {
    name: formData.get("name"),
    tagline: formData.get("tagline") || undefined,
    description: formData.get("description") || undefined,
    city: formData.get("city"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    capacitySeated: formData.get("capacitySeated") || undefined,
    capacityStanding: formData.get("capacityStanding") || undefined,
    sizeSqm: formData.get("sizeSqm") || undefined,
    amenities: formData.get("amenities") || undefined,
    eventTypes: formData.get("eventTypes") || undefined,
    policies: formData.get("policies") || undefined,
    links: formData.get("links") || undefined,
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
    phone: data.phone ?? null,
    contact_email: data.contactEmail || null,
    capacity_seated: data.capacitySeated ?? null,
    capacity_standing: data.capacityStanding ?? null,
    size_sqm: data.sizeSqm ?? null,
    amenities: commaList(data.amenities),
    event_types: commaList(data.eventTypes),
    policies: data.policies ?? null,
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
  const { data: venue, error } = await supabase
    .from("event_venues")
    .insert({ ...venueRow(parsed.data), slug: slugify(parsed.data.name) })
    .select("id")
    .single();
  if (error || !venue) return { error: error?.code === "23505" ? "A venue with this name already exists." : "Could not create the venue." };
  await replacePropertyLinks(supabase, { venueId: venue.id }, parseLinks(parsed.data.links));
  await invalidateCache("events");
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
  if (error) return { error: "Could not save the venue." };
  await replacePropertyLinks(supabase, { venueId: id }, parseLinks(parsed.data.links));
  await invalidateCache("events");
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { error: null };
}

const hallBookingStatuses = [
  "pending",
  "waitlisted",
  "confirmed",
  "cancelled",
  "completed",
  "refunded",
  "no_show",
  "failed",
] as const;

/**
 * Declining a manual request must also close its UNPAID order — otherwise
 * the customer's bookings page keeps showing "pending payment" for a stay
 * nobody granted. Paid orders are left alone: money moved, so the refund
 * flow owns those.
 */
async function cancelUnpaidOrderForBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingColumn: "hall_booking_id" | "hotel_booking_id",
  bookingId: string
) {
  const { data: item } = await supabase
    .from("order_items")
    .select("order:order_id (id, status)")
    .eq(bookingColumn, bookingId)
    .maybeSingle();
  if (item?.order && (item.order.status === "pending_payment" || item.order.status === "held")) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", item.order.id);
  }
}

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
  const { data: booking } = await supabase
    .from("hall_bookings")
    .select("id, venue_id, status, start_date, end_date, price")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking not found." };
  if (!(nextHallBookingMoves(booking, todayIso(), true) as string[]).includes(status)) {
    return { error: `A ${booking.status.replace(/_/g, " ")} booking can't be changed to ${status.replace(/_/g, " ")}.` };
  }
  if (status === "confirmed" && Number(booking.price) <= 0) return { error: "Set the price before confirming." };

  const { error } = await supabase
    .from("hall_bookings")
    .update({ status: status as (typeof hallBookingStatuses)[number] })
    .eq("id", bookingId)
    .eq("status", booking.status);
  if (error) return { error: error.code === "P0001" ? error.message : "The booking could not be updated." };
  revalidatePath(`/admin/events/${booking.venue_id}`, "layout");
  revalidatePath(`/manager/venues/${booking.venue_id}`, "layout");
  if (status === "cancelled") await cancelUnpaidOrderForBooking(supabase, "hall_booking_id", bookingId);
  revalidatePath("/admin/events");
  revalidatePath("/admin/queue");
  return { error: null };
}

const hotelBookingMoves = ["confirmed", "completed", "no_show", "cancelled"] as const;

/**
 * Admin-side hotel booking decision for the manual-booking queue. Promoting
 * a waitlisted booking runs the DB-side availability re-check, so a stale
 * waitlist entry whose nights are still full fails loudly here instead of
 * double-booking. Allowed moves, the unpaid-order cancel and the guest
 * notification are shared with the partner and manager consoles
 * (applyHotelBookingMove, hotel_booking_decided).
 */
export async function updateHotelBookingStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const status = String(formData.get("status"));
  if (!hotelBookingMoves.includes(status as (typeof hotelBookingMoves)[number])) {
    return { error: "Invalid status." };
  }

  const result = await applyHotelBookingMove(bookingId, status as (typeof hotelBookingMoves)[number]);
  if (result.error) return result;
  revalidatePath("/admin/queue");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/hotels", "layout");
  revalidatePath("/manager", "layout");
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
  // Same rule as hotels: the quote moves only while nothing is paid.
  const { data: item } = await supabase
    .from("order_items")
    .select("id, order:order_id (id, status, agency_id)")
    .eq("hall_booking_id", bookingId)
    .maybeSingle();
  if (item?.order && item.order.status !== "pending_payment" && item.order.status !== "held") {
    return { error: "Only unpaid bookings can be repriced." };
  }

  const { data: updated, error } = await supabase
    .from("hall_bookings")
    .update({ price })
    .eq("id", bookingId)
    .in("status", ["pending", "waitlisted"])
    .select("id")
    .maybeSingle();
  if (error) return { error: "Could not save the price." };
  if (!updated) return { error: "Only an open request can be repriced." };

  if (item?.order) {
    await repriceQuotedOrder(supabase, item.order, item.id, "hall", price);
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin/queue");
  return { error: null };
}

/**
 * Quote/adjust a manual hotel booking's price; keeps the unpaid order's
 * totals in sync. The seeded STS-catalog hotels have no room rates yet
 * (price on request) — this is where staff set the real price before
 * confirming the request, mirroring updateHallBookingPrice.
 */
export async function updateHotelBookingPrice(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price." };

  const supabase = await createClient();
  // A quote can only change while nothing has been paid against it: once the
  // order moves on, the booking total must keep matching what was charged.
  const { data: item } = await supabase
    .from("order_items")
    .select("id, order:order_id (id, status, agency_id)")
    .eq("hotel_booking_id", bookingId)
    .maybeSingle();
  if (item?.order && item.order.status !== "pending_payment" && item.order.status !== "held") {
    return { error: "Only unpaid bookings can be repriced." };
  }

  const { error } = await supabase
    .from("hotel_bookings")
    .update({ total_price: price })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  if (item?.order) {
    await repriceQuotedOrder(supabase, item.order, item.id, "hotel", price);
  }

  revalidatePath("/admin/queue");
  revalidatePath("/admin/orders");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Hotel/room publish gate — the partner-facing forms (partner-actions.ts)
// only ever write 'draft'/'pending_review'; going to 'published' (real,
// bookable-by-customers) or 'suspended' is admin-only, from here. Mirrors
// the venue_partner pattern this codebase already used correctly for venues.
// ---------------------------------------------------------------------------
const listingStatuses: ListingStatus[] = ["draft", "pending_review", "published", "suspended"];

export async function adminSetHotelStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const hotelId = String(formData.get("hotelId"));
  const status = String(formData.get("status")) as ListingStatus;
  if (!listingStatuses.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("hotels").update({ status }).eq("id", hotelId);
  if (error) return { error: error.message };
  await invalidateCache("hotels");
  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${hotelId}`);
  return { error: null };
}

export async function adminSetRoomStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const roomId = String(formData.get("roomId"));
  const status = String(formData.get("status")) as ListingStatus;
  if (!listingStatuses.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_rooms").update({ status }).eq("id", roomId);
  if (error) return { error: error.message };
  await invalidateCache("hotels");
  revalidatePath("/admin/hotels", "layout");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Hotel Management (admin CRUD) — mirrors the venue admin CRUD above and the
// hotel-partner wizard's row shape (src/modules/hotels/partner-actions.ts),
// but admin can set status all the way to 'published'/'suspended' directly
// and isn't scoped to a partner_id. Creating a hotel here leaves partner_id
// null (STS-managed) — the same "no owning partner" convention the 50
// manual-inventory hotels already use.
// ---------------------------------------------------------------------------
const hotelSchema = z.object({
  name: z.string().min(2, "Enter a hotel name."),
  description: z.string().optional(),
  descriptionSo: z.string().optional(),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(1, "Enter a city."),
  countryCode: z.string().min(2, "Enter a country code.").max(2),
  phone: phoneSchema.optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  policies: z.string().optional(),
  amenities: z.string().optional(),
  links: z.string().optional(),
  bookingMode: z.enum(["manual", "instant"]),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
  partnerId: z.string().uuid().optional().or(z.literal("")),
});

function hotelInput(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    descriptionSo: formData.get("descriptionSo") || undefined,
    starRating: formData.get("starRating") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    city: formData.get("city"),
    countryCode: formData.get("countryCode") || "SO",
    phone: formData.get("phone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    checkInTime: formData.get("checkInTime") || undefined,
    checkOutTime: formData.get("checkOutTime") || undefined,
    policies: formData.get("policies") || undefined,
    amenities: formData.get("amenities") || undefined,
    links: formData.get("links") || undefined,
    bookingMode: "instant",
    status: formData.get("status"),
    partnerId: (() => {
      const v = formData.get("partnerId");
      return v && v !== "none" ? v : undefined;
    })(),
  };
}

function hotelRow(data: z.infer<typeof hotelSchema>) {
  return {
    name: data.name,
    description: data.description ?? null,
    description_so: data.descriptionSo ?? null,
    star_rating: data.starRating ?? null,
    address_line: data.addressLine ?? null,
    city: data.city,
    country_code: data.countryCode.toUpperCase(),
    phone: data.phone ?? null,
    contact_email: data.contactEmail || null,
    check_in_time: data.checkInTime || null,
    check_out_time: data.checkOutTime || null,
    policies: data.policies ?? null,
    amenities: commaList(data.amenities),
    booking_mode: data.bookingMode,
    status: data.status as ListingStatus,
    partner_id: data.partnerId || null,
  };
}

export async function createHotel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = hotelSchema.safeParse(hotelInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: hotel, error } = await supabase
    .from("hotels")
    .insert({ ...hotelRow(parsed.data), slug: slugify(parsed.data.name) })
    .select("id")
    .single();
  if (error || !hotel) return { error: error?.message ?? "Could not create the hotel." };
  await replacePropertyLinks(supabase, { hotelId: hotel.id }, parseLinks(parsed.data.links));
  await invalidateCache("hotels");
  revalidatePath("/admin/hotels");
  revalidatePath("/hotels");
  return { error: null };
}

export async function updateHotel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const parsed = hotelSchema.safeParse(hotelInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("hotels").update(hotelRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  await replacePropertyLinks(supabase, { hotelId: id }, parseLinks(parsed.data.links));
  await invalidateCache("hotels");
  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${id}`);
  revalidatePath("/hotels");
  return { error: null };
}

const roomSchema = z.object({
  name: z.string().min(1, "Enter a room name."),
  nameSo: z.string().optional(),
  description: z.string().optional(),
  descriptionSo: z.string().optional(),
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
  // Matches hotel_rooms_base_price_positive (20260903000006): no room ships
  // without a nightly rate.
  basePrice: z.coerce.number().gt(0, "Enter the nightly rate."),
  currency: z.string().min(3).max(3).default("USD"),
  // Matches hotel_rooms_total_units_positive (20260903000009): the room-count
  // gap this closed — every room needs a real count or availability can
  // never be computed (see room_units_left / hotel_room_nights).
  totalUnits: z.coerce.number().int().min(1, "Enter how many rooms of this type exist.").max(5000),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

function roomInput(formData: FormData) {
  return {
    name: formData.get("name"),
    nameSo: formData.get("nameSo") || undefined,
    description: formData.get("description") || undefined,
    descriptionSo: formData.get("descriptionSo") || undefined,
    maxOccupancy: formData.get("maxOccupancy"),
    bedType: formData.get("bedType") || undefined,
    floor: formData.get("floor") || undefined,
    sizeSqm: formData.get("sizeSqm") || undefined,
    amenities: formData.get("amenities") || undefined,
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "USD",
    totalUnits: formData.get("totalUnits") || undefined,
    status: formData.get("status"),
  };
}

function roomRow(data: z.infer<typeof roomSchema>) {
  return {
    name: data.name,
    name_so: data.nameSo ?? null,
    description: data.description ?? null,
    description_so: data.descriptionSo ?? null,
    max_occupancy: data.maxOccupancy,
    bed_type: data.bedType ?? null,
    floor: data.floor ?? null,
    size_sqm: data.sizeSqm ?? null,
    amenities: data.amenities,
    base_price: data.basePrice,
    currency: data.currency.toUpperCase(),
    total_units: data.totalUnits ?? null,
    status: data.status as ListingStatus,
  };
}

export async function createRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const hotelId = String(formData.get("hotelId"));
  const parsed = roomSchema.safeParse(roomInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // A room with no photo is unbookable in practice — a traveller doesn't
  // request a room they can't see — so at least one is required at creation,
  // not left as an easy-to-skip follow-up step on a separate page.
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) return { error: "Add at least one room photo." };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("hotel_rooms")
    .insert({ ...roomRow(parsed.data), hotel_id: hotelId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const uploadForm = new FormData();
  uploadForm.set("id", inserted.id);
  for (const photo of photos) uploadForm.append("files", photo);
  const uploadResult = await uploadImages(TARGETS.room, uploadForm);
  if (uploadResult?.error) {
    // All-or-nothing: a room row with no photo isn't the state either of us
    // wants, so undo the insert rather than leave it half-created.
    await supabase.from("hotel_rooms").delete().eq("id", inserted.id);
    return { error: uploadResult.error };
  }

  await rememberRoomType(supabase, parsed.data.name);
  await invalidateCache("hotels");
  revalidatePath(`/admin/hotels/${hotelId}`);
  return { error: null };
}

export async function updateRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const hotelId = String(formData.get("hotelId"));
  const roomId = String(formData.get("roomId"));
  const parsed = roomSchema.safeParse(roomInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_rooms").update(roomRow(parsed.data)).eq("id", roomId);
  if (error) return { error: error.message };
  await rememberRoomType(supabase, parsed.data.name);
  await invalidateCache("hotels");
  revalidatePath(`/admin/hotels/${hotelId}`);
  return { error: null };
}

const MAX_INVENTORY_RANGE_DAYS = 366;

function datesInRange(startDate: string, endDate: string): string[] | null {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > MAX_INVENTORY_RANGE_DAYS) return null;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
}

const inventoryRangeSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

/** Admin equivalent of setRoomInventory (modules/hotels/inventory-actions.ts) — per-date capacity/price overrides on top of the room's baseline count. */
export async function setRoomInventoryAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = inventoryRangeSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const detail = parseInventoryDetail(formData);
  if (!detail.success) return { error: detail.error.issues[0].message };

  const dates = datesInRange(parsed.data.startDate, parsed.data.endDate);
  if (!dates) return { error: `Choose a range of at most ${MAX_INVENTORY_RANGE_DAYS} days.` };

  const supabase = await createClient();
  const built = await inventoryRows(supabase, parsed.data.roomId, dates, detail.data);
  if ("error" in built) return { error: built.error };
  const { error } = await supabase.from("hotel_room_inventory").upsert(built.rows, { onConflict: "room_id,date" });
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}/rooms/${parsed.data.roomId}`);
  return { error: null };
}

export async function clearRoomInventoryAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = inventoryRangeSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hotel_room_inventory")
    .delete()
    .eq("room_id", parsed.data.roomId)
    .gte("date", parsed.data.startDate)
    .lte("date", parsed.data.endDate);
  if (error) return { error: error.message };

  revalidatePath(`/admin/hotels/${parsed.data.hotelId}/rooms/${parsed.data.roomId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Property reviews (admin-authored) — shared by hotels and venues, same
// hotel_id/venue_id-exactly-one-set shape as property_links.
// ---------------------------------------------------------------------------
const reviewSchema = z.object({
  authorName: z.string().min(2, "Enter a name."),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().optional(),
});

export async function createPropertyReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const hotelId = formData.get("hotelId")?.toString() || undefined;
  const venueId = formData.get("venueId")?.toString() || undefined;
  if (!hotelId && !venueId) return { error: "Missing property id." };

  const parsed = reviewSchema.safeParse({
    authorName: formData.get("authorName"),
    rating: formData.get("rating"),
    body: formData.get("body") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("property_reviews").insert({
    hotel_id: hotelId ?? null,
    venue_id: venueId ?? null,
    author_name: parsed.data.authorName,
    rating: parsed.data.rating,
    body: parsed.data.body ?? null,
    source: "manual",
  });
  if (error) return { error: error.message };

  await invalidateCache("hotels");
  revalidatePath(hotelId ? `/admin/hotels/${hotelId}` : `/admin/events/${venueId}`);
  return { error: null };
}

export async function deletePropertyReview(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const reviewId = String(formData.get("reviewId"));
  const hotelId = formData.get("hotelId")?.toString() || undefined;
  const venueId = formData.get("venueId")?.toString() || undefined;

  const supabase = await createClient();
  await supabase.from("property_reviews").delete().eq("id", reviewId);
  await invalidateCache("hotels");
  revalidatePath(hotelId ? `/admin/hotels/${hotelId}` : `/admin/events/${venueId}`);
}

