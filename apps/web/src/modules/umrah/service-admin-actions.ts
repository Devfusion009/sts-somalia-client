"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

function revalidateCatalog() {
  revalidatePath("/admin/catalog/umrah/services");
  revalidatePath("/umrah/private");
}

const optionalNumber = (max: number) =>
  z.union([z.literal(""), z.coerce.number().int().min(0).max(max)]).optional();

const SHARINGS = [1, 2, 3, 4] as const;
const HOTEL_CATEGORIES = new Set(["hotel_makkah", "hotel_madinah"]);

// "" clears that occupancy's price, so the hotel falls back to its base price.
const sharingPriceSchema = z.union([
  z.literal(""),
  z.coerce.number().positive("Room type prices must be greater than zero."),
]);

const serviceSchema = z.object({
  serviceId: z.union([z.string().uuid(), z.literal("")]).optional(),
  category: z.enum([
    "hotel_makkah",
    "hotel_madinah",
    "flight",
    "visa",
    "transport",
    "intercity",
    "extra",
  ]),
  name: z.string().trim().min(2, "Enter a name customers will recognise."),
  description: z.union([z.string().trim().max(500), z.literal("")]).optional(),
  // "" is the "all tiers" choice, not a missing value — an Umrah visa is the
  // same product whichever standard the trip is booked at.
  tier: z.union([z.enum(["basic", "standard", "premium"]), z.literal("")]).optional(),
  price: z.coerce.number().min(0, "Enter a price of zero or more."),
  priceUnit: z.enum(["per_person", "per_person_per_night", "per_night", "per_booking"]),
  starRating: optionalNumber(5),
  distanceToHaram: optionalNumber(100000),
  isDefault: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  status: z.enum(["draft", "published", "suspended"]),
});

export async function saveUmrahService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();

  const parsed = serviceSchema.safeParse({
    serviceId: formData.get("serviceId") ?? "",
    category: formData.get("category"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    tier: formData.get("tier") ?? "",
    price: formData.get("price"),
    priceUnit: formData.get("priceUnit"),
    starRating: formData.get("starRating") ?? "",
    distanceToHaram: formData.get("distanceToHaram") ?? "",
    isDefault: formData.get("isDefault") === "on",
    sortOrder: formData.get("sortOrder") || 0,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const sharingPrices: { sharing: (typeof SHARINGS)[number]; price: number | null }[] = [];
  for (const sharing of SHARINGS) {
    const value = HOTEL_CATEGORIES.has(d.category)
      ? String(formData.get(`sharingPrice${sharing}`) ?? "").trim()
      : "";
    const price = sharingPriceSchema.safeParse(value);
    if (!price.success) return { error: price.error.issues[0].message };
    sharingPrices.push({ sharing, price: price.data === "" ? null : price.data });
  }

  const supabase = await createClient();
  const row = {
    category: d.category,
    name: d.name,
    description: d.description || null,
    tier: d.tier || null,
    price: d.price,
    price_unit: d.priceUnit,
    star_rating: d.starRating === "" || d.starRating === undefined ? null : d.starRating,
    distance_to_haram_m:
      d.distanceToHaram === "" || d.distanceToHaram === undefined ? null : d.distanceToHaram,
    is_default: d.isDefault,
    sort_order: d.sortOrder,
    status: d.status,
  };

  const { data: saved, error } = d.serviceId
    ? await supabase.from("umrah_services").update(row).eq("id", d.serviceId).select("id").single()
    : await supabase.from("umrah_services").insert(row).select("id").single();

  if (error) {
    // The one-default-per-(category, tier) partial unique index is the most
    // likely failure here, and its raw message names an index rather than the
    // thing the admin did wrong.
    if (error.code === "23505") {
      return {
        error:
          "Another published option in this category is already the default for that standard. Clear its default first.",
      };
    }
    return { error: error.message };
  }

  const sharingError = await saveUmrahSharingPrices(supabase, saved.id, sharingPrices);
  if (sharingError) return { error: sharingError };

  revalidateCatalog();
  return { error: null };
}

/**
 * Upserts the occupancy prices that are set and deletes the ones that were
 * cleared. A non-hotel service arrives with every price null, so switching a
 * hotel to another category removes its occupancy prices too.
 */
async function saveUmrahSharingPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  serviceId: string,
  prices: { sharing: number; price: number | null }[]
): Promise<string | null> {
  const upserts = prices
    .filter((p): p is { sharing: number; price: number } => p.price !== null)
    .map((p) => ({ service_id: serviceId, sharing: p.sharing, price: p.price }));
  const cleared = prices.filter((p) => p.price === null).map((p) => p.sharing);

  if (upserts.length) {
    const { error } = await supabase
      .from("umrah_service_sharing_prices")
      .upsert(upserts, { onConflict: "service_id,sharing" });
    if (error) return error.message;
  }
  if (cleared.length) {
    const { error } = await supabase
      .from("umrah_service_sharing_prices")
      .delete()
      .eq("service_id", serviceId)
      .in("sharing", cleared);
    if (error) return error.message;
  }
  return null;
}

export async function deleteUmrahService(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const serviceId = String(formData.get("serviceId"));
  if (!z.string().uuid().safeParse(serviceId).success) return;

  const supabase = await createClient();
  // Requests that already chose this service keep their snapshotted line
  // (umrah_custom_request_services.service_id is ON DELETE SET NULL), so
  // deleting a service never rewrites a quote a customer already saw.
  await supabase.from("umrah_services").delete().eq("id", serviceId);
  revalidateCatalog();
}

/**
 * Quote/adjust a private Umrah request's price before the customer pays —
 * the same job updateHotelBookingPrice does for manual hotel requests, and it
 * keeps the unpaid order in step with the booking so what is charged is
 * exactly what was confirmed here.
 */
export async function updateUmrahRequestPrice(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("umrah_bookings")
    .update({ total_price: price })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  const { data: item } = await supabase
    .from("order_items")
    .select("id, order:order_id (id, status)")
    .eq("umrah_booking_id", bookingId)
    .maybeSingle();

  if (item?.order && item.order.status === "pending_payment") {
    await supabase
      .from("order_items")
      .update({ unit_price: price, total_price: price })
      .eq("id", item.id);
    await supabase.from("orders").update({ subtotal: price, total: price }).eq("id", item.order.id);
  }

  revalidatePath("/admin/umrah/requests");
  revalidatePath("/admin/queue");
  revalidatePath("/admin/orders");
  return { error: null };
}

/**
 * Confirm or decline a private Umrah request. Declining also cancels the
 * order while it is still unpaid — a paid order is deliberately left alone,
 * because the refund flow owns it (the same rule the hotel/hall decline
 * actions follow).
 */
export async function updateUmrahBookingStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const bookingId = String(formData.get("bookingId"));
  const status = String(formData.get("status"));
  if (!["confirmed", "cancelled"].includes(status)) return { error: "Unknown status." };

  const supabase = await createClient();
  // Confirming goes through the stage machine so it writes the timeline and
  // notifies the customer; it also moves status to confirmed.
  const { error } =
    status === "confirmed"
      ? await supabase.rpc("set_umrah_booking_stage", {
          p_booking_id: bookingId,
          p_stage: "confirmed",
        })
      : await supabase.from("umrah_bookings").update({ status: "cancelled" }).eq("id", bookingId);
  if (error) return { error: error.message };

  if (status === "cancelled") {
    const { data: item } = await supabase
      .from("order_items")
      .select("order:order_id (id, status)")
      .eq("umrah_booking_id", bookingId)
      .maybeSingle();
    if (item?.order && ["pending_payment", "held"].includes(item.order.status)) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", item.order.id);
    }
  }

  revalidatePath("/admin/umrah/requests");
  revalidatePath("/admin/queue");
  return { error: null };
}
