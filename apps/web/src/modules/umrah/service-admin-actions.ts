"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

function revalidateCatalog() {
  revalidatePath("/admin/catalog/umrah/services");
  revalidatePath("/umrah/private");
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numOrNull(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === "" ? null : Number(v);
}

export async function saveUmrahService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.admin.services.save.mutate({
      serviceId: str(formData, "serviceId") || undefined,
      category: str(formData, "category") as "flight",
      name: str(formData, "name"),
      description: str(formData, "description") || undefined,
      tier: (str(formData, "tier") || null) as "basic" | null,
      price: Number(formData.get("price")),
      priceUnit: str(formData, "priceUnit") as "per_person",
      starRating: numOrNull(formData, "starRating"),
      distanceToHaram: numOrNull(formData, "distanceToHaram"),
      isDefault: formData.get("isDefault") === "on",
      sortOrder: Number(str(formData, "sortOrder") || 0),
      status: str(formData, "status") as "draft",
      sharingPrices: [1, 2, 3, 4].map((sharing) => ({ sharing, price: numOrNull(formData, `sharingPrice${sharing}`) })),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The service could not be saved.") };
  }
  revalidateCatalog();
  return { error: null };
}

export async function deleteUmrahService(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.admin.services.delete.mutate({ serviceId: str(formData, "serviceId") });
  } catch {
    return;
  }
  revalidateCatalog();
}

function revalidateRequests() {
  revalidatePath("/admin/umrah/requests");
  revalidatePath("/admin/queue");
  revalidatePath("/admin/orders");
}

/** Quote a private request before the customer pays; an agency order keeps its margin. */
export async function updateUmrahRequestPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.admin.requests.quote.mutate({ bookingId: str(formData, "bookingId"), price: Number(formData.get("price")) });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The price could not be saved.") };
  }
  revalidateRequests();
  return { error: null };
}

/** Confirm or decline a private request. */
export async function updateUmrahBookingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.admin.requests.decide.mutate({
      bookingId: str(formData, "bookingId"),
      status: str(formData, "status") as "confirmed" | "cancelled",
      note: str(formData, "note").slice(0, 500) || undefined,
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The request could not be updated.") };
  }
  revalidateRequests();
  return { error: null };
}
