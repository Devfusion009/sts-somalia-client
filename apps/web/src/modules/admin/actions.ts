"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { phoneSchema } from "@/modules/partner-applications/schemas";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import type { Database } from "@/lib/types/database.types";
import { UMRAH_INCLUDE_KEYS } from "@/modules/umrah/includes";
import { rememberRoomType } from "@/modules/hotels/room-types";
import { uploadImages } from "@/modules/admin/property-gallery-actions";
import { TARGETS } from "@/modules/admin/gallery-targets";
import { repriceQuotedOrder } from "@/modules/orders/helpers";
import { commaList, parseLinks, replacePropertyLinks } from "@/modules/hotels/listing-fields";
import { sanitizeKey, parseDocumentSlotsJson } from "./visa-type-utils";
import { COUNTRY_NAMES } from "@/lib/countries";

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

  const supabase = await createClient();
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
  applicationQuestions: z.string().optional(),
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
  });

/** Rows from the admin's structured application-questions editor — same JSON + key-sanitization approach as document slots. */
function parseApplicationQuestionsJson(input: string | undefined) {
  if (!input) return [];
  let rows: unknown;
  try {
    rows = JSON.parse(input);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, i) => {
      const r = (row ?? {}) as Record<string, string>;
      const key = sanitizeKey(r.key ?? "", `question_${i + 1}`);
      const label = (r.label ?? "").trim();
      const type = r.type === "yesno" || r.type === "select" ? r.type : "text";
      const options =
        type === "select" ? (r.options ?? "").split(",").map((o) => o.trim()).filter(Boolean) : undefined;
      return {
        key,
        label,
        type,
        ...(options && options.length > 0 ? { options } : {}),
        required: r.required !== "false",
      };
    })
    .filter((q) => q.label);
}

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
    applicationQuestions: formData.get("applicationQuestions") || undefined,
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
    application_questions: parseApplicationQuestionsJson(data.applicationQuestions),
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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/**
 * datetime-local carries no zone; flight times are the airport's wall clock,
 * so they are stored UTC-tagged as entered and always read back in UTC.
 */
const optionalFlightTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Enter a valid flight time.")
  .transform((v) => (v === "" ? null : `${v}:00Z`));

const departureSchema = z.object({
  packageId: z.string().uuid(),
  departureDate: z.string().min(1, "Pick a departure date."),
  returnDate: z.string().min(1, "Pick a return date."),
  totalSeats: z.coerce.number().int().min(1, "Total seats must be at least 1."),
  offlineSeats: z.coerce.number().int().min(0, "Offline seats cannot be negative."),
  priceOverride: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter a valid price."),
  outboundAirline: optionalText(80),
  outboundFlightNumber: optionalText(20),
  outboundDepartsAt: optionalFlightTime,
  outboundArrivesAt: optionalFlightTime,
  returnAirline: optionalText(80),
  returnFlightNumber: optionalText(20),
  returnDepartsAt: optionalFlightTime,
  returnArrivesAt: optionalFlightTime,
  baggageNote: optionalText(200),
});

type ParsedDeparture =
  | { ok: false; error: string }
  | { ok: true; packageId: string; row: Omit<Database["public"]["Tables"]["umrah_package_departures"]["Insert"], "package_id"> };

function parseDeparture(formData: FormData): ParsedDeparture {
  const text = (key: string) => String(formData.get(key) ?? "");
  const parsed = departureSchema.safeParse({
    packageId: formData.get("packageId"),
    departureDate: formData.get("departureDate"),
    returnDate: formData.get("returnDate"),
    totalSeats: formData.get("totalSeats"),
    offlineSeats: text("offlineSeats") || "0",
    priceOverride: text("priceOverride"),
    outboundAirline: text("outboundAirline"),
    outboundFlightNumber: text("outboundFlightNumber"),
    outboundDepartsAt: text("outboundDepartsAt"),
    outboundArrivesAt: text("outboundArrivesAt"),
    returnAirline: text("returnAirline"),
    returnFlightNumber: text("returnFlightNumber"),
    returnDepartsAt: text("returnDepartsAt"),
    returnArrivesAt: text("returnArrivesAt"),
    baggageNote: text("baggageNote"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.returnDate <= d.departureDate) return { ok: false, error: "Return date must be after the departure date." };
  if (d.offlineSeats > d.totalSeats) return { ok: false, error: "Seats sold exceed total seats." };
  if (d.outboundDepartsAt && d.outboundArrivesAt && d.outboundArrivesAt <= d.outboundDepartsAt) {
    return { ok: false, error: "Outbound arrival must be after departure." };
  }
  if (d.returnDepartsAt && d.returnArrivesAt && d.returnArrivesAt <= d.returnDepartsAt) {
    return { ok: false, error: "Return arrival must be after departure." };
  }
  return {
    ok: true,
    packageId: d.packageId,
    row: {
        departure_date: d.departureDate,
        return_date: d.returnDate,
        total_seats: d.totalSeats,
        offline_seats: d.offlineSeats,
        price_override: d.priceOverride,
        outbound_airline: d.outboundAirline,
        outbound_flight_number: d.outboundFlightNumber,
        outbound_departs_at: d.outboundDepartsAt,
        outbound_arrives_at: d.outboundArrivesAt,
        return_airline: d.returnAirline,
        return_flight_number: d.returnFlightNumber,
        return_departs_at: d.returnDepartsAt,
        return_arrives_at: d.returnArrivesAt,
      baggage_note: d.baggageNote,
    },
  };
}

function departureErrorMessage(error: { message: string; code?: string }) {
  if (error.message.includes("seats_within_total")) return "Seats sold exceed total seats.";
  if (error.message.includes("umrah_package_departures_check")) return "Return date must be after the departure date.";
  if (error.code === "23503") return "This departure has bookings and cannot be deleted.";
  return error.message;
}

function revalidateUmrahPackage(packageId: string) {
  revalidatePath("/admin/catalog/umrah");
  revalidatePath(`/admin/catalog/umrah/${packageId}`);
}

export async function createUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = parseDeparture(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_package_departures")
    .insert({ package_id: parsed.packageId, ...parsed.row });
  if (error) return { error: departureErrorMessage(error) };
  revalidateUmrahPackage(parsed.packageId);
  return { error: null };
}

export async function updateUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const departureId = z.string().uuid().safeParse(formData.get("departureId"));
  if (!departureId.success) return { error: "Invalid departure." };
  const parsed = parseDeparture(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("umrah_package_departures")
    .update(parsed.row)
    .eq("id", departureId.data)
    .eq("package_id", parsed.packageId)
    .select("id");
  if (error) return { error: departureErrorMessage(error) };
  if (!data?.length) return { error: "Departure not found." };
  revalidateUmrahPackage(parsed.packageId);
  return { error: null };
}

export async function deleteUmrahDeparture(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const departureId = z.string().uuid().safeParse(formData.get("departureId"));
  if (!departureId.success) return { error: "Invalid departure." };

  const supabase = await createClient();
  const { data: departure } = await supabase
    .from("umrah_package_departures")
    .select("id, package_id, booked_seats")
    .eq("id", departureId.data)
    .maybeSingle();
  if (!departure) return { error: "Departure not found." };
  if (departure.booked_seats > 0) return { error: "This departure has bookings and cannot be deleted." };

  const { error } = await supabase.from("umrah_package_departures").delete().eq("id", departure.id);
  if (error) return { error: departureErrorMessage(error) };
  revalidateUmrahPackage(departure.package_id);
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
  phone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  capacitySeated: z.coerce.number().int().min(1).optional(),
  capacityStanding: z.coerce.number().int().min(1).optional(),
  sizeSqm: z.coerce.number().min(0).optional(),
  amenities: z.string().optional(),
  eventTypes: z.string().optional(),
  policies: z.string().optional(),
  links: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
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
  if (error || !venue) return { error: error?.message ?? "Could not create the venue." };
  await replacePropertyLinks(supabase, { venueId: venue.id }, parseLinks(parsed.data.links));
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
  await replacePropertyLinks(supabase, { venueId: id }, parseLinks(parsed.data.links));
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
  const { error } = await supabase
    .from("hall_bookings")
    .update({ status: status as (typeof hallBookingStatuses)[number] })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  if (status === "cancelled") await cancelUnpaidOrderForBooking(supabase, "hall_booking_id", bookingId);
  revalidatePath("/admin/events");
  revalidatePath("/admin/queue");
  return { error: null };
}

const hotelBookingStatuses = [
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
 * Admin-side hotel booking status control for the manual-booking queue —
 * previously only the hotel partner could move a hotel booking's status.
 * Promoting a waitlisted booking runs the DB-side availability re-check
 * (reserve_inventory_on_waitlist_promotion), so a stale waitlist entry
 * whose nights are still full fails loudly here instead of double-booking.
 */
export async function updateHotelBookingStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const status = String(formData.get("status"));
  if (!hotelBookingStatuses.includes(status as (typeof hotelBookingStatuses)[number])) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hotel_bookings")
    .update({ status: status as (typeof hotelBookingStatuses)[number] })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  if (status === "cancelled") await cancelUnpaidOrderForBooking(supabase, "hotel_booking_id", bookingId);
  revalidatePath("/admin/queue");
  revalidatePath("/admin/orders");
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
    .select("id, order:order_id (id, status, agency_id)")
    .eq("hall_booking_id", bookingId)
    .maybeSingle();
  if (item?.order && item.order.status === "pending_payment") {
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
  const { error } = await supabase
    .from("hotel_bookings")
    .update({ total_price: price })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  const { data: item } = await supabase
    .from("order_items")
    .select("id, order:order_id (id, status, agency_id)")
    .eq("hotel_booking_id", bookingId)
    .maybeSingle();
  if (item?.order && item.order.status === "pending_payment") {
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
    bookingMode: formData.get("bookingMode") ?? "manual",
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

  const detail = z
    .object({
      totalUnits: z.coerce.number().int().min(0, "Units can't be negative.").max(1000),
      priceOverride: z.coerce.number().min(0).optional(),
    })
    .safeParse({
      totalUnits: formData.get("totalUnits"),
      priceOverride: formData.get("priceOverride") || undefined,
    });
  if (!detail.success) return { error: detail.error.issues[0].message };

  const dates = datesInRange(parsed.data.startDate, parsed.data.endDate);
  if (!dates) return { error: `Choose a range of at most ${MAX_INVENTORY_RANGE_DAYS} days.` };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_room_inventory").upsert(
    dates.map((date) => ({
      room_id: parsed.data.roomId,
      date,
      total_units: detail.data.totalUnits,
      price_override: detail.data.priceOverride ?? null,
    })),
    { onConflict: "room_id,date" }
  );
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
  revalidatePath(hotelId ? `/admin/hotels/${hotelId}` : `/admin/events/${venueId}`);
}

// ---------------------------------------------------------------------------
// Onboard a hotel partner directly — for a real-world partner STS already
// has a deal with, who won't be self-applying through /account/become. This
// deliberately reuses the exact same path a normal application takes rather
// than inventing a second, parallel way for a hotel_partners row to come
// into existence: it files a hotel_partner_applications row on the owner's
// behalf, then calls the same approve_hotel_partner_application() RPC the
// real applicant-review flow calls (see application-actions.ts:
// approveApplication). The result is indistinguishable from an
// applicant-submitted, admin-approved partner — same partner_accounts row,
// same activity-log "account_created" event, same console at
// /admin/partners/hotel-partner/[id].
//
// The owner must already have an STS account (same requirement the
// existing "Add a team member" form states) — their profile email becomes
// the org's contact_email via the RPC, exactly like a real applicant's
// email does, so there's no separate "org contact email" field to keep in
// sync with it.
// ---------------------------------------------------------------------------
const onboardPartnerSchema = z.object({
  partnerName: z.string().min(2, "Enter a business name."),
  ownerEmail: z.string().email("Enter the owner's STS account email."),
  contactPhone: z.string().optional(),
  countryCode: z.string().max(2).optional(),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
});

export async function onboardHotelPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = onboardPartnerSchema.safeParse({
    partnerName: formData.get("partnerName"),
    ownerEmail: formData.get("ownerEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
    countryCode: formData.get("countryCode") || undefined,
    commissionRate: formData.get("commissionRate") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.ownerEmail)
    .maybeSingle();
  if (!owner) {
    return { error: "No STS account found for that email — ask them to sign up first, then try again." };
  }

  const { data: refNumber, error: refError } = await supabase.rpc("generate_hotel_partner_application_ref");
  if (refError || !refNumber) return { error: refError?.message ?? "Could not generate a reference number." };

  const { data: application, error: appError } = await supabase
    .from("hotel_partner_applications")
    .insert({
      applicant_id: owner.id,
      business_name: parsed.data.partnerName,
      business_details: { contactMobile: parsed.data.contactPhone ?? null },
      status: "pending",
      reference_number: refNumber,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (appError || !application) return { error: appError?.message ?? "Could not create the application." };

  const { data: partnerId, error: approveError } = await supabase.rpc("approve_hotel_partner_application", {
    application_id: application.id,
    p_note: "Onboarded directly by admin.",
  });
  if (approveError) return { error: approveError.message };

  if (partnerId) {
    await supabase
      .from("hotel_partners")
      .update({
        contact_phone: parsed.data.contactPhone ?? null,
        country_code: parsed.data.countryCode ?? null,
        commission_rate: parsed.data.commissionRate,
      })
      .eq("id", partnerId);
  }

  revalidatePath("/admin/hotels");
  revalidatePath("/admin/partners");
  redirect(`/admin/partners/hotel-partner/${refNumber}`);
}
