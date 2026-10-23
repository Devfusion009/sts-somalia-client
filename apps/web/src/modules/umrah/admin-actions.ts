"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

/** Form adapters for the admin package screens; the API validates and writes. */

function revalidatePackage(packageId: string) {
  revalidatePath(`/admin/catalog/umrah/${packageId}`);
  revalidatePath("/admin/catalog/umrah");
  revalidatePath("/umrah");
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** "" -> null, otherwise a number (NaN fails the API's schema with its own message). */
function numOrNull(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === "" ? null : Number(v);
}

async function run(packageId: string, call: () => Promise<unknown>, fallback: string): Promise<ActionState> {
  try {
    await call();
  } catch (error) {
    return { error: trpcErrorMessage(error, fallback) };
  }
  revalidatePackage(packageId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Gallery — two-phase direct upload: sign, browser PUT, commit
// ---------------------------------------------------------------------------
export async function uploadUmrahImages(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { upload?: { path: string; signedUrl: string } }> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  const trpc = await getServerTrpcForActions();
  try {
    if (formData.get("phase") === "sign") {
      const upload = await trpc.umrah.admin.packages.signImage.mutate({
        packageId,
        name: str(formData, "name"),
        type: str(formData, "type") as "image/jpeg",
        size: Number(formData.get("size") ?? 0),
      });
      return { error: null, upload };
    }
    if (formData.get("phase") === "commit") {
      await trpc.umrah.admin.packages.commitImage.mutate({ packageId, path: str(formData, "path") });
      revalidatePackage(packageId);
      return { error: null };
    }
  } catch (error) {
    return { error: trpcErrorMessage(error, "Upload could not be started.") };
  }
  return { error: "Upload could not be started." };
}

export async function removeUmrahImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  await run(packageId, async () => (await getServerTrpcForActions()).umrah.admin.packages.removeImage.mutate({ packageId, path: str(formData, "path") }), "");
}

/** Promotes one image to index 0 — the cover shot. */
export async function setUmrahCoverImage(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  await run(packageId, async () => (await getServerTrpcForActions()).umrah.admin.packages.setCover.mutate({ packageId, path: str(formData, "path") }), "");
}

// ---------------------------------------------------------------------------
// Package detail
// ---------------------------------------------------------------------------
export async function updateUmrahPackageDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  return run(
    packageId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.packages.updateDetails.mutate({
        packageId,
        tagline: str(formData, "tagline") || undefined,
        tier: str(formData, "tier") || undefined,
        isFeatured: formData.get("isFeatured") === "on",
        originIata: str(formData, "originIata") || undefined,
        destinationIata: str(formData, "destinationIata") || undefined,
        originalPrice: numOrNull(formData, "originalPrice"),
        mealPlan: str(formData, "mealPlan") as "none",
        mealsNote: str(formData, "mealsNote") || undefined,
        contactPersonName: str(formData, "contactPersonName") || undefined,
        contactPersonPhone: str(formData, "contactPersonPhone") || undefined,
        contactPersonEmail: str(formData, "contactPersonEmail"),
        contactWhatsapp: str(formData, "contactWhatsapp") || undefined,
        depositPercent: numOrNull(formData, "depositPercent"),
        balanceDueDays: Number(str(formData, "balanceDueDays") || 30),
        fullPaymentBeforeDocuments: formData.get("fullPaymentBeforeDocuments") === "on",
      }),
    "The package could not be saved."
  );
}

// ---------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------
export async function saveUmrahHotel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  return run(
    packageId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.packages.saveHotel.mutate({
        packageId,
        hotelRowId: str(formData, "hotelRowId") || undefined,
        city: str(formData, "city") as "makkah",
        name: str(formData, "name"),
        starRating: numOrNull(formData, "starRating"),
        distanceToHaramM: numOrNull(formData, "distanceToHaramM"),
        nights: numOrNull(formData, "nights"),
        roomType: str(formData, "roomType") || undefined,
        sortOrder: Number(str(formData, "sortOrder") || 0),
      }),
    "The hotel could not be saved."
  );
}

export async function deleteUmrahHotel(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  await run(packageId, async () => (await getServerTrpcForActions()).umrah.admin.packages.deleteHotel.mutate({ packageId, rowId: str(formData, "hotelRowId") }), "");
}

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------
export async function saveUmrahItineraryDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  return run(
    packageId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.packages.saveDay.mutate({
        packageId,
        dayId: str(formData, "dayId") || undefined,
        dayNumber: Number(formData.get("dayNumber")),
        title: str(formData, "title"),
        description: str(formData, "description") || undefined,
      }),
    "The day could not be saved."
  );
}

export async function deleteUmrahItineraryDay(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  await run(packageId, async () => (await getServerTrpcForActions()).umrah.admin.packages.deleteDay.mutate({ packageId, rowId: str(formData, "dayId") }), "");
}

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------
export async function saveUmrahPricing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  return run(
    packageId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.packages.savePricing.mutate({
        packageId,
        sharing: Number(formData.get("sharing")),
        price: Number(formData.get("price")),
      }),
    "The rate could not be saved."
  );
}

export async function deleteUmrahPricing(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  await run(packageId, async () => (await getServerTrpcForActions()).umrah.admin.packages.deletePricing.mutate({ packageId, rowId: str(formData, "pricingId") }), "");
}

// ---------------------------------------------------------------------------
// Local agencies
// ---------------------------------------------------------------------------
export async function setUmrahPackageAgencies(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const packageId = str(formData, "packageId");
  return run(
    packageId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.packages.setAgencies.mutate({
        packageId,
        agencyIds: formData.getAll("agencyIds").map(String).filter(Boolean),
      }),
    "Agencies could not be saved."
  );
}
