"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import type { Database } from "@/lib/types/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type ListingStatus = Database["public"]["Enums"]["listing_status"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

async function callRpc(fn: "approve_agency_application" | "approve_hotel_partner_application" | "approve_affiliate_application", applicationId: string): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { application_id: applicationId });
  if (error) return { error: error.message };
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  return { error: null };
}

async function callRejectRpc(fn: "reject_agency_application" | "reject_hotel_partner_application" | "reject_affiliate_application", applicationId: string, notes: string | null): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { application_id: applicationId, notes: notes ?? undefined });
  if (error) return { error: error.message };
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  return { error: null };
}

export async function approveAgencyApplication(_prev: ActionState, formData: FormData) {
  return callRpc("approve_agency_application", String(formData.get("applicationId")));
}
export async function rejectAgencyApplication(_prev: ActionState, formData: FormData) {
  return callRejectRpc("reject_agency_application", String(formData.get("applicationId")), (formData.get("notes") as string) || null);
}
export async function approveHotelPartnerApplication(_prev: ActionState, formData: FormData) {
  return callRpc("approve_hotel_partner_application", String(formData.get("applicationId")));
}
export async function rejectHotelPartnerApplication(_prev: ActionState, formData: FormData) {
  return callRejectRpc("reject_hotel_partner_application", String(formData.get("applicationId")), (formData.get("notes") as string) || null);
}
export async function approveAffiliateApplication(_prev: ActionState, formData: FormData) {
  return callRpc("approve_affiliate_application", String(formData.get("applicationId")));
}
export async function rejectAffiliateApplication(_prev: ActionState, formData: FormData) {
  return callRejectRpc("reject_affiliate_application", String(formData.get("applicationId")), (formData.get("notes") as string) || null);
}

const orderStatuses: OrderStatus[] = ["pending_payment", "paid", "processing", "completed", "cancelled", "refunded"];

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
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
  processingDaysMin: z.coerce.number().int().min(0).optional(),
  processingDaysMax: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  requiredDocuments: z.string().optional(),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

function parseDocLines(input: string | undefined) {
  if (!input) return [];
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = visaTypeSchema.safeParse({
    destinationCountryCode: formData.get("destinationCountryCode"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    processingDaysMin: formData.get("processingDaysMin") || undefined,
    processingDaysMax: formData.get("processingDaysMax") || undefined,
    price: formData.get("price"),
    currency: formData.get("currency"),
    requiredDocuments: formData.get("requiredDocuments") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("visa_types").insert({
    destination_country_code: parsed.data.destinationCountryCode.toUpperCase(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    processing_days_min: parsed.data.processingDaysMin ?? null,
    processing_days_max: parsed.data.processingDaysMax ?? null,
    price: parsed.data.price,
    currency: parsed.data.currency.toUpperCase(),
    required_documents: parseDocLines(parsed.data.requiredDocuments),
    status: parsed.data.status as ListingStatus,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/visa");
  return { error: null };
}

export async function updateVisaType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const parsed = visaTypeSchema.safeParse({
    destinationCountryCode: formData.get("destinationCountryCode"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    processingDaysMin: formData.get("processingDaysMin") || undefined,
    processingDaysMax: formData.get("processingDaysMax") || undefined,
    price: formData.get("price"),
    currency: formData.get("currency"),
    requiredDocuments: formData.get("requiredDocuments") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("visa_types")
    .update({
      destination_country_code: parsed.data.destinationCountryCode.toUpperCase(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      processing_days_min: parsed.data.processingDaysMin ?? null,
      processing_days_max: parsed.data.processingDaysMax ?? null,
      price: parsed.data.price,
      currency: parsed.data.currency.toUpperCase(),
      required_documents: parseDocLines(parsed.data.requiredDocuments),
      status: parsed.data.status as ListingStatus,
    })
    .eq("id", id);
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

const umrahPackageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationDays: z.coerce.number().int().min(1),
  includes: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  status: z.enum(["draft", "pending_review", "published", "suspended"]),
});

export async function createUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = umrahPackageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationDays: formData.get("durationDays"),
    includes: formData.get("includes") || undefined,
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
    includes: parseDocLines(parsed.data.includes),
    base_price: parsed.data.basePrice,
    currency: parsed.data.currency.toUpperCase(),
    status: parsed.data.status as ListingStatus,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/catalog/umrah");
  return { error: null };
}

export async function updateUmrahPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const parsed = umrahPackageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationDays: formData.get("durationDays"),
    includes: formData.get("includes") || undefined,
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
      includes: parseDocLines(parsed.data.includes),
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
  await requireRole("admin");
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
  await requireRole("admin");
  const userId = String(formData.get("userId"));
  const newStatus = String(formData.get("newStatus")) as AccountStatus;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_account_status", { target_user_id: userId, new_status: newStatus });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}
